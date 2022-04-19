package sims

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var (
	_ backend.StreamHandler    = (*SimulationEngine)(nil)
	_ backend.QueryDataHandler = (*SimulationEngine)(nil)
)

type SimulationEngine struct {
	logger log.Logger

	// Lookup by Type
	registry map[string]simulationInfo

	// The running instances
	running map[string]Simulation

	// safe changes
	mutex sync.Mutex
}

func (s *SimulationEngine) register(info simulationInfo) error {
	if info.create == nil {
		return fmt.Errorf("invalid simulation -- missing create function: " + info.Type)
	}
	if info.Type == "" {
		return fmt.Errorf("missing type")
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	_, ok := s.registry[info.Type]
	if ok {
		return fmt.Errorf("already registered")
	}

	s.registry[info.Type] = info
	return nil
}

type simulationInitalizer = func() simulationInfo

func NewSimulationEngine() (*SimulationEngine, error) {
	s := &SimulationEngine{
		registry: make(map[string]simulationInfo),
		running:  make(map[string]Simulation),
		logger:   log.New("tsdb.sims"),
	}
	// Initalize each type
	initializers := []simulationInitalizer{
		newFlightSimInfo,
		newSinewaveInfo,
	}

	for _, init := range initializers {
		err := s.register(init())
		if err != nil {
			return s, err
		}
	}
	return s, nil
}

func (s *SimulationEngine) Lookup(info simulationState) (Simulation, error) {
	hz := info.Key.TickHZ
	if hz < (1 / 60.0) {
		return nil, fmt.Errorf("frequency is too slow")
	}
	if hz > 50 {
		return nil, fmt.Errorf("frequency is too fast")
	}
	if info.Key.Type == "" {
		return nil, fmt.Errorf("missing simulation type")
	}

	key := info.Key.String()
	s.mutex.Lock()
	defer s.mutex.Unlock()

	v, ok := s.running[key]
	if ok {
		return v, nil
	}

	t, ok := s.registry[info.Key.Type]
	if !ok {
		return nil, fmt.Errorf("unknown simulation type")
	}

	v, err := t.create(info)
	if err == nil {
		s.running[key] = v
	}
	return v, err
}

func (s *SimulationEngine) Kill(info simulationState) {
	key := info.Key.String()
	s.mutex.Lock()
	defer s.mutex.Unlock()

	v, ok := s.running[key]
	if ok {
		_ = v.Close()

		delete(s.running, key)
	}
}

type simulationQuery struct {
	simulationState
	Stream bool `json:"stream"`
}

type dumbQueryQrapper struct {
	Sim simulationQuery `json:"sim"`
}

func (s *SimulationEngine) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		sq := &dumbQueryQrapper{}
		err := json.Unmarshal(q.JSON, sq)
		if err != nil {
			return nil, fmt.Errorf("failed to parse query json: %v", err)
		}

		sim, err := s.Lookup(sq.Sim.simulationState)
		if err != nil {
			return nil, fmt.Errorf("error fetching simulation: %v", err)
		}

		if sim == nil {
			return nil, fmt.Errorf("invalid simulation: %v", sq)
		}

		timeWalkerMs := q.TimeRange.From.UnixNano() / int64(time.Millisecond)
		to := q.TimeRange.To.UnixNano() / int64(time.Millisecond)
		stepMillis := q.Interval.Milliseconds()

		frame := sim.NewFrame(0)

		maxPoints := q.MaxDataPoints * 2
		for i := int64(0); i < maxPoints && timeWalkerMs < to; i++ {
			t := time.UnixMilli(timeWalkerMs).UTC()

			vals := sim.GetValues(t)
			for _, f := range frame.Fields {
				v, ok := vals[f.Name]
				if ok {
					f.Append(v)
				} else {
					f.Extend(1) // fill with nullable value
				}
			}

			timeWalkerMs += stepMillis
		}

		// // When close to now, link to the live streaming channel
		// if q.TimeRange.To.Add(time.Second * 2).After(time.Now()) {
		// 	f.frame.Meta = &data.FrameMeta{
		// 		Channel: "plugin/testdata/flight-5hz-stream",
		// 	}
		// }

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *SimulationEngine) getSimFromPath(path string) (Simulation, error) {
	idx := strings.Index(path, "sim/")
	if idx >= 0 {
		path = path[idx+4:]
	}

	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		return nil, fmt.Errorf("missing frequency")
	}
	if !strings.HasSuffix(parts[1], "hz") {
		return nil, fmt.Errorf("invalid path frequency.  Expecting `hz` suffix")
	}
	hz, err := strconv.ParseFloat(strings.TrimSuffix(parts[1], "hz"), 64)
	if err != nil {
		return nil, fmt.Errorf("error parsing frequency from: %s", parts[1])
	}
	if len(parts) == 2 {
		parts = append(parts, "") // empty UID
	}

	key := simulationKey{
		Type:   parts[0],
		TickHZ: hz,
		UID:    parts[2],
	}
	if path != key.String() {
		return nil, fmt.Errorf("path should match: %s", key.String())
	}

	return s.Lookup(simulationState{
		Key: key,
	})
}

func (s *SimulationEngine) GetSimulationHandler(rw http.ResponseWriter, req *http.Request) {
	var result interface{}
	path := req.URL.Path
	if path == "/sims" {
		v := make([]simulationInfo, 0, len(s.registry))
		for _, value := range s.registry {
			v = append(v, value)
		}
		result = v
	} else if strings.HasPrefix(path, "/sim/") {
		rw.WriteHeader(400)
		sim, err := s.getSimFromPath(path)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusNotFound)
			return
		}

		// With a POST, update the values
		if req.Method == "POST" {
			body, err := getBodyFromRequest(req)
			if err == nil {
				err = sim.SetConfig(body)
			}
			if err != nil {
				http.Error(rw, err.Error(), http.StatusBadRequest)
				return
			}
		}
		result = sim.GetState()
	}

	bytes, err := json.Marshal(&result)
	if err != nil {
		s.logger.Error("Failed to marshal response body to JSON", "error", err)
	}

	rw.Header().Set("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)
	if _, err := rw.Write(bytes); err != nil {
		s.logger.Error("Failed to write response", "error", err)
	}
}

func (s *SimulationEngine) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	sim, err := s.getSimFromPath(req.Path) // includes sim
	if err != nil {
		return nil, err
	}

	frame := sim.NewFrame(1)
	setFrameRow(frame, 0, sim.GetValues(time.Now()))
	initial, err := backend.NewInitialFrame(frame, data.IncludeAll)

	return &backend.SubscribeStreamResponse{
		Status:      backend.SubscribeStreamStatusOK,
		InitialData: initial,
	}, err
}

func (s *SimulationEngine) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	sim, err := s.getSimFromPath(req.Path) // includes sim
	if err != nil {
		return err
	}

	hz := sim.GetState().Key.TickHZ
	ticker := time.NewTicker(time.Duration(hz * float64(time.Second)))
	defer ticker.Stop()

	mode := data.IncludeDataOnly

	frame := sim.NewFrame(1)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()

		case t := <-ticker.C:
			setFrameRow(frame, 0, sim.GetValues(t))
			sender.SendFrame(frame, mode)
		}
	}
}

func (s *SimulationEngine) PublishStream(_ context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}
