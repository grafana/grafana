package grpcserver

import (
	"context"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/array"
	"github.com/apache/arrow/go/arrow/flight"
	"github.com/apache/arrow/go/arrow/ipc"
	"github.com/apache/arrow/go/arrow/memory"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// ArrowFlightService implements the Arrow Flight GRPC protocol:
// https://pkg.go.dev/github.com/apache/arrow/go/arrow@v0.0.0-20211112161151-bc219186db40/flight
type ArrowFlightService struct {
	cfg           *setting.Cfg
	logger        log.Logger
	flightService *flightService
}

type flightService struct {
	*flight.FlightServiceService
}

func ProvideArrowFlightService(cfg *setting.Cfg, grpcServerProvider Provider) (*ArrowFlightService, error) {
	logger := log.New("arrow-flight-service")
	fs := &flight.FlightServiceService{DoGet: DoGet}
	flight.RegisterFlightServiceService(grpcServerProvider.GetServer(), fs)
	return &ArrowFlightService{
		cfg:           cfg,
		logger:        logger,
		flightService: &flightService{fs},
	}, nil
}

func (s *ArrowFlightService) Run(ctx context.Context) error {
	s.logger.Debug("Arrow Flight GRPC service running")
	<-ctx.Done()
	return ctx.Err()
}

func (s *ArrowFlightService) IsDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.IsFeatureToggleEnabled(featuremgmt.FlagGrpcServer)
}

func DoGet(t *flight.Ticket, s flight.FlightService_DoGetServer) error {
	mem := memory.NewCheckedAllocator(memory.NewGoAllocator())
	schema := arrow.NewSchema(
		[]arrow.Field{
			{Name: "i32", Type: arrow.PrimitiveTypes.Int32},
			{Name: "f64", Type: arrow.PrimitiveTypes.Float64},
		},
		nil,
	)

	w := flight.NewRecordWriter(s, ipc.WithSchema(schema))
	defer w.Close()

	col1 := func() array.Interface {
		ib := array.NewInt32Builder(mem)
		defer ib.Release()

		ib.AppendValues([]int32{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, nil)
		return ib.NewInt32Array()
	}()
	defer col1.Release()

	col2 := func() array.Interface {
		b := array.NewFloat64Builder(mem)
		defer b.Release()

		b.AppendValues([]float64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, nil)
		return b.NewFloat64Array()
	}()
	defer col2.Release()

	cols := []array.Interface{col1, col2}
	rec := array.NewRecord(schema, cols, -1)
	defer rec.Release()

	return w.Write(rec)
}
