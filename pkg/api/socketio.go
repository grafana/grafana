package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/googollee/go-socket.io"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/eventpublisher"
	"github.com/grafana/grafana/pkg/services/metricpublisher"
	"github.com/grafana/grafana/pkg/services/rabbitmq"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/streadway/amqp"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"sync"
)

var server *socketio.Server
var bufCh chan m.MetricDefinition
var localSockets *LocalSockets

func StoreMetric(m *m.MetricDefinition) {
	bufCh <- *m
}

type LocalSockets struct {
	sync.RWMutex
	Sockets map[string]socketio.Socket
}

func (s *LocalSockets) Set(id string, socket socketio.Socket) {
	s.Lock()
	defer s.Unlock()
	s.Sockets[id] = socket
}

func (s *LocalSockets) Remove(id string) {
	s.Lock()
	defer s.Unlock()
	delete(s.Sockets, id)
}

func (s *LocalSockets) Emit(id string, event string, payload interface{}) {
	s.RLock()
	defer s.RUnlock()
	socket, ok := s.Sockets[id]
	if !ok {
		log.Info("socket " + id + " is not local.")
		return
	}
	socket.Emit(event, payload)
}

func NewLocalSockets() *LocalSockets {
	return &LocalSockets{
		Sockets: make(map[string]socketio.Socket),
	}
}

type CollectorContext struct {
	*m.SignedInUser
	Collector *m.CollectorDTO
	Socket    socketio.Socket
	SocketId  string
}

type BinMessage struct {
	Payload *socketio.Attachment
}

func register(so socketio.Socket) (*CollectorContext, error) {
	req := so.Request()
	req.ParseForm()
	keyString := req.Form.Get("apiKey")
	name := req.Form.Get("name")

	if name == "" {
		return nil, errors.New("collector name not provided.")
	}

	versionStr := req.Form.Get("version")
	if versionStr == "" {
		return nil, errors.New("version number not provided.")
	}
	versionParts := strings.SplitN(versionStr, ".", 2)
	if len(versionParts) != 2 {
		return nil, errors.New("could not parse version number")
	}
	versionMajor, err := strconv.ParseInt(versionParts[0], 10, 64)
	if err != nil {
		return nil, errors.New("could not parse version number")
	}
	versionMinor, err := strconv.ParseFloat(versionParts[1], 64)
	if err != nil {
		return nil, errors.New("could not parse version number.")
	}

	//--------- set required version of collector.------------//
	//
	if versionMajor < 0 || versionMinor < 1.1 {
		return nil, errors.New("invalid collector version. Please upgrade.")
	}
	//
	//--------- set required version of collector.------------//
	log.Info(fmt.Sprintf("collector with version %d.%f connected", versionMajor, versionMinor))
	if keyString != "" {
		// base64 decode key
		decoded, err := apikeygen.Decode(keyString)
		if err != nil {
			return nil, m.ErrInvalidApiKey
		}
		// fetch key
		keyQuery := m.GetApiKeyByNameQuery{KeyName: decoded.Name, OrgId: decoded.OrgId}
		if err := bus.Dispatch(&keyQuery); err != nil {
			return nil, m.ErrInvalidApiKey
		}
		apikey := keyQuery.Result

		// validate api key
		if !apikeygen.IsValid(decoded, apikey.Key) {
			return nil, m.ErrInvalidApiKey
		}
		// lookup collector
		colQuery := m.GetCollectorByNameQuery{Name: name, OrgId: apikey.OrgId}
		if err := bus.Dispatch(&colQuery); err != nil {
			//collector not found, so lets create a new one.
			colCmd := m.AddCollectorCommand{
				OrgId:   apikey.OrgId,
				Name:    name,
				Enabled: true,
			}
			if err := bus.Dispatch(&colCmd); err != nil {
				return nil, err
			}
			colQuery.Result = colCmd.Result
		}

		sess := &CollectorContext{
			SignedInUser: &m.SignedInUser{
				IsGrafanaAdmin: apikey.IsAdmin,
				OrgRole:        apikey.Role,
				ApiKeyId:       apikey.Id,
				OrgId:          apikey.OrgId,
				Name:           apikey.Name,
			},
			Collector: colQuery.Result,
			Socket:    so,
			SocketId:  so.Id(),
		}
		if err := sess.Save(); err != nil {
			return nil, err
		}
		return sess, nil
	}
	return nil, m.ErrInvalidApiKey
}

func InitCollectorController() {
	sec := setting.Cfg.Section("event_publisher")

	if sec.Key("enabled").MustBool(false) {
		url := sec.Key("rabbitmq_url").String()
		exchange := sec.Key("exchange").String()
		exch := rabbitmq.Exchange{
			Name:         exchange,
			ExchangeType: "topic",
			Durable:      true,
		}
		q := rabbitmq.Queue{
			Name:       "",
			Durable:    false,
			AutoDelete: true,
			Exclusive:  true,
		}
		consumer := rabbitmq.Consumer{
			Url:        url,
			Exchange:   &exch,
			Queue:      &q,
			BindingKey: "INFO.monitor.#",
		}
		err := consumer.Connect()
		if err != nil {
			log.Fatal(0, "failed to start event.consumer.", err)
		}
		consumer.Consume(eventConsumer)
	} else {
		//tap into the update/add/Delete events emitted when monitors are modified.
		bus.AddEventListener(EmitUpdateMonitor)
		bus.AddEventListener(EmitAddMonitor)
		bus.AddEventListener(EmitDeleteMonitor)
	}
	cmd := m.ClearCollectorSessionCommand{ProcessId: 0}
	if err := bus.Dispatch(&cmd); err != nil {
		log.Fatal(4, "failed to clear collectorSessions.", err)
	}
	bufCh = make(chan m.MetricDefinition, runtime.NumCPU())
	go metricpublisher.ProcessBuffer(bufCh)
}

func init() {
	localSockets = NewLocalSockets()
	var err error
	server, err = socketio.NewServer([]string{"polling", "websocket"})
	if err != nil {
		log.Fatal(4, "failed to initialize socketio.", err)
		return
	}
	server.On("connection", func(so socketio.Socket) {
		c, err := register(so)
		if err != nil {
			if err == m.ErrInvalidApiKey {
				log.Info("collector failed to authenticate.")
			} else if err.Error() == "invalid collector version. Please upgrade." {
				log.Info("collector is wrong version")
			} else {
				log.Error(0, "Failed to initialize collector.", err)
			}
			so.Emit("error", err.Error())
			return
		}
		//get list of monitorTypes
		cmd := &m.GetMonitorTypesQuery{}
		if err := bus.Dispatch(cmd); err != nil {
			log.Error(0, "Failed to initialize collector.", err)
			so.Emit("error", err)
			return
		}
		c.Socket.Emit("ready", map[string]interface{}{"collector": c.Collector, "monitor_types": cmd.Result})
		log.Info(fmt.Sprintf("New connection for %s owned by OrgId: %d", c.Collector.Name, c.OrgId))
		c.Socket.On("event", c.OnEvent)
		c.Socket.On("results", c.OnResults)
		c.Socket.On("disconnection", c.OnDisconnection)
		RefreshCollector(c.Collector.Id)
	})

	server.On("error", func(so socketio.Socket, err error) {
		log.Error(0, "socket emitted error", err)
	})
}

func (c *CollectorContext) Save() error {
	cmd := &m.AddCollectorSessionCommand{
		CollectorId: c.Collector.Id,
		SocketId:    c.Socket.Id(),
		OrgId:       c.OrgId,
	}
	if err := bus.Dispatch(cmd); err != nil {
		return err
	}
	localSockets.Set(c.SocketId, c.Socket)
	return nil
}

func (c *CollectorContext) Remove() error {
	log.Info(fmt.Sprintf("removing socket with Id %s", c.SocketId))
	cmd := &m.DeleteCollectorSessionCommand{
		SocketId:    c.SocketId,
		OrgId:       c.OrgId,
		CollectorId: c.Collector.Id,
	}
	err := bus.Dispatch(cmd)
	localSockets.Remove(c.SocketId)
	return err
}

func (c *CollectorContext) OnDisconnection() {
	log.Info(fmt.Sprintf("%s disconnected", c.Collector.Name))
	if err := c.Remove(); err != nil {
		log.Error(4, fmt.Sprintf("Failed to remove collectorSession. %s", c.Collector.Name), err)
	}
}

func (c *CollectorContext) OnEvent(msg *m.EventDefinition) {
	log.Info(fmt.Sprintf("recieved event from %s", c.Collector.Name))
	if !c.Collector.Public {
		msg.OrgId = c.OrgId
	}
	msgString, err := json.Marshal(msg)
	if err != nil {
		log.Error(0, "Failed to marshal event.", err)
	}
	// send to RabbitMQ
	routingKey := fmt.Sprintf("EVENT.%s.%s", msg.Severity, msg.EventType)
	go eventpublisher.Publish(routingKey, msgString)
}

func (c *CollectorContext) OnResults(results []*m.MetricDefinition) {
	for _, r := range results {
		if !c.Collector.Public {
			r.OrgId = c.OrgId
		}
		StoreMetric(r)
	}
}

func RefreshCollector(collectorId int64) {
	log.Info(fmt.Sprintf("Collector %d refreshing", collectorId))
	//step 1. get list of collectorSessions for this collector.
	q := m.GetCollectorSessionsQuery{CollectorId: collectorId}
	if err := bus.Dispatch(&q); err != nil {
		log.Error(0, "failed to get list of collectorSessions.", err)
		return
	}
	totalSessions := len(q.Result)
	//step 2. for each session
	for pos, sess := range q.Result {
		//step 3. get list of monitors configured for this colletor.
		monQuery := m.GetMonitorsQuery{
			CollectorId:    []int64{collectorId},
			IsGrafanaAdmin: true,
			Modulo:         int64(totalSessions),
			ModuloOffset:   int64(pos),
		}
		if err := bus.Dispatch(&monQuery); err != nil {
			log.Error(0, "failed to get list of monitors.", err)
			return
		}
		log.Info("sending refresh to " + sess.SocketId)
		//step 5. send to socket.
		localSockets.Emit(sess.SocketId, "refresh", monQuery.Result)
	}
}

func SocketIO(c *middleware.Context) {
	if server == nil {
		log.Fatal(4, "socket.io server not initialized.", nil)
	}

	server.ServeHTTP(c.Resp, c.Req.Request)
}

func EmitUpdateMonitor(event *events.MonitorUpdated) error {
	log.Info("processing monitorUpdated event.")
	seenCollectors := make(map[int64]bool)
	for _, collectorId := range event.Collectors {
		seenCollectors[collectorId] = true
		if err := EmitEvent(collectorId, "updated", event); err != nil {
			return err
		}
	}
	for _, collectorId := range event.LastState.Collectors {
		if _, ok := seenCollectors[collectorId]; !ok {
			if err := EmitEvent(collectorId, "removed", event); err != nil {
				return err
			}
		}
	}
	return nil
}

func EmitAddMonitor(event *events.MonitorCreated) error {
	log.Info("processing monitorCreated event")
	for _, collectorId := range event.Collectors {
		if err := EmitEvent(collectorId, "created", event); err != nil {
			return err
		}
	}
	return nil
}

func EmitDeleteMonitor(event *events.MonitorRemoved) error {
	log.Info("processing monitorRemoved event")
	for _, collectorId := range event.Collectors {
		if err := EmitEvent(collectorId, "removed", event); err != nil {
			return err
		}
	}
	return nil
}

func EmitEvent(collectorId int64, eventName string, event interface{}) error {
	q := m.GetCollectorSessionsQuery{CollectorId: collectorId}
	if err := bus.Dispatch(&q); err != nil {
		return err
	}
	totalSessions := int64(len(q.Result))
	if totalSessions < 1 {
		return nil
	}
	eventId := reflect.ValueOf(event).Elem().FieldByName("Id").Int()
	log.Info(fmt.Sprintf("emitting %s event for MonitorId %d totalSessions: %d", eventName, eventId, totalSessions))
	pos := eventId % totalSessions
	socketId := q.Result[pos].SocketId

	localSockets.Emit(socketId, eventName, event)

	return nil
}

func eventConsumer(msg *amqp.Delivery) error {
	log.Info("processing amqp message with routing key: " + msg.RoutingKey)
	eventRaw := events.OnTheWireEvent{}
	err := json.Unmarshal(msg.Body, &eventRaw)
	if err != nil {
		log.Error(0, "failed to unmarshal event.", err)
	}
	payloadRaw, err := json.Marshal(eventRaw.Payload)
	if err != nil {
		log.Error(0, "unable to marshal event payload back to json.", err)
	}
	switch msg.RoutingKey {
	case "INFO.monitor.updated":
		event := events.MonitorUpdated{}
		if err := json.Unmarshal(payloadRaw, &event); err != nil {
			log.Error(0, "unable to unmarshal payload into MonitorUpdated event.", err)
		}
		if err := EmitUpdateMonitor(&event); err != nil {
			return err
		}
		break
	case "INFO.monitor.created":
		event := events.MonitorCreated{}
		if err := json.Unmarshal(payloadRaw, &event); err != nil {
			log.Error(0, "unable to unmarshal payload into MonitorUpdated event.", err)
		}
		if err := EmitAddMonitor(&event); err != nil {
			return err
		}
		break
	case "INFO.monitor.removed":
		event := events.MonitorRemoved{}
		if err := json.Unmarshal(payloadRaw, &event); err != nil {
			log.Error(0, "unable to unmarshal payload into MonitorUpdated event.", err)
		}
		if err := EmitDeleteMonitor(&event); err != nil {
			return err
		}
		break
	}

	return nil
}
