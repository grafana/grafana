package tempo

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"reflect"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
	"google.golang.org/grpc/metadata"
)

func TestProcessStream_ValidInput_ReturnsNoError(t *testing.T) {
	service := &Service{}
	searchClient := &mockStreamer{}
	streamSender := &mockSender{}
	err := service.processStream(searchClient, streamSender)
	if err != nil {
		t.Errorf("Expected no error, but got %s", err)
	}
}
func TestProcessStream_InvalidInput_ReturnsError(t *testing.T) {
	logger := log.New("tsdb.tempo.test")
	service := &Service{
		logger: logger,
	}
	searchClient := &mockStreamer{err: errors.New("invalid input")}
	streamSender := &mockSender{}
	err := service.processStream(searchClient, streamSender)
	if err != nil {
		if !strings.Contains(err.Error(), "invalid input") {
			t.Errorf("Expected error message to contain 'invalid input', but got %s", err)
		}
	}
}
func TestProcessStream_ValidInput_ReturnsExpectedOutput(t *testing.T) {
	logger := log.New("tsdb.tempo.test")
	service := &Service{
		logger: logger,
	}
	searchClient := &mockStreamer{
		tracingMetadata: []*tempopb.TraceSearchMetadata{
			{TraceID: "abcdefg", StartTimeUnixNano: 1234},
			{TraceID: "hijklmn", StartTimeUnixNano: 5678},
		},
		metrics: &tempopb.SearchMetrics{
			CompletedJobs:   2,
			TotalJobs:       5,
			InspectedBytes:  123456789,
			TotalBlockBytes: 987654321,
			InspectedTraces: 123,
		},
		expectedResponses: []ExtendedResponse{
			{
				SearchResponse: &tempopb.SearchResponse{
					Traces: []*tempopb.TraceSearchMetadata{
						{TraceID: "abcdefg", StartTimeUnixNano: 1234},
					},
					Metrics: &tempopb.SearchMetrics{
						CompletedJobs:   2,
						TotalJobs:       5,
						InspectedBytes:  123456789,
						TotalBlockBytes: 987654321,
						InspectedTraces: 123,
					},
				},
				State: dataquery.SearchStreamingStateStreaming,
			},
			{
				SearchResponse: &tempopb.SearchResponse{
					Traces: []*tempopb.TraceSearchMetadata{
						{TraceID: "abcdefg", StartTimeUnixNano: 1234},
						{TraceID: "hijklmn", StartTimeUnixNano: 5678},
					},
					Metrics: &tempopb.SearchMetrics{
						CompletedJobs:   2,
						TotalJobs:       5,
						InspectedBytes:  123456789,
						TotalBlockBytes: 987654321,
						InspectedTraces: 123,
					},
				},
				State: dataquery.SearchStreamingStateStreaming,
			},

			{
				SearchResponse: &tempopb.SearchResponse{
					Traces: []*tempopb.TraceSearchMetadata{
						{TraceID: "abcdefg", StartTimeUnixNano: 1234},
						{TraceID: "hijklmn", StartTimeUnixNano: 5678},
					},
					Metrics: &tempopb.SearchMetrics{
						CompletedJobs:   2,
						TotalJobs:       5,
						InspectedBytes:  123456789,
						TotalBlockBytes: 987654321,
						InspectedTraces: 123,
					},
				},
				State: dataquery.SearchStreamingStateDone,
			},
		},
	}
	streamSender := &mockSender{}
	err := service.processStream(searchClient, streamSender)
	if err != nil {
		t.Errorf("Expected no error, but got %s", err)
		return
	}
	if len(streamSender.responses) != 3 {
		t.Errorf("Expected 3 responses, but got %d", len(streamSender.responses))
		return
	}

	for i, frame := range streamSender.responses {
		expectedMetrics := searchClient.expectedResponses[i].Metrics
		expectedTraces := searchClient.expectedResponses[i].Traces
		expectedState := string(searchClient.expectedResponses[i].State)

		if len(frame.Fields) != 4 {
			t.Errorf("Expected 4 fields in data frame, but was '%d'", len(frame.Fields))
			return
		}
		var traceList []*tempopb.TraceSearchMetadata
		if err := json.Unmarshal(frame.Fields[0].At(0).(json.RawMessage), &traceList); err != nil {
			t.Errorf("Error unmarshaling trace list: %s", err)
		} else {
			if !reflect.DeepEqual(traceList, expectedTraces) {
				t.Errorf("Expected response traces to be '%+v', but was '%+v'",
					expectedTraces, traceList)
				return
			}
		}

		var metrics *tempopb.SearchMetrics
		if err := json.Unmarshal(frame.Fields[1].At(0).(json.RawMessage), &metrics); err != nil {
			t.Errorf("Error unmarshaling metrics: %s", err)
		} else {
			if !reflect.DeepEqual(metrics, expectedMetrics) {
				t.Errorf("Expected response metrics to be '%+v', but was '%+v'",
					expectedMetrics, metrics)
				return
			}
		}

		state := frame.Fields[2].At(0).(string)
		if state != expectedState {
			t.Errorf("Expected response state to be '%+v', but was '%+v'", expectedState,
				state)
			return
		}
		frameErr := frame.Fields[3].At(0).(string)
		if frameErr != "" {
			t.Errorf("Didn't expect error but got '%+v'", frameErr)
			return
		}
	}
}

type mockSender struct {
	backend.StreamSender
	responses []*data.Frame
}

func (s *mockSender) SendFrame(frame *data.Frame, include data.FrameInclude) error {
	s.responses = append(s.responses, frame)
	return nil
}

type mockStreamer struct {
	tracingMetadata       []*tempopb.TraceSearchMetadata
	copyOfTracingMetadata []*tempopb.TraceSearchMetadata
	metrics               *tempopb.SearchMetrics
	expectedResponses     []ExtendedResponse
	err                   error
}

func (m *mockStreamer) Recv() (*tempopb.SearchResponse, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.copyOfTracingMetadata == nil {
		m.copyOfTracingMetadata = make([]*tempopb.TraceSearchMetadata, len(m.tracingMetadata))
		copy(m.copyOfTracingMetadata, m.tracingMetadata)
	}
	if len(m.copyOfTracingMetadata) == 0 {
		return &tempopb.SearchResponse{
			Metrics: m.metrics,
			Traces:  m.tracingMetadata,
		}, io.EOF
	}
	traceMetadata := m.copyOfTracingMetadata[0]
	m.copyOfTracingMetadata = m.copyOfTracingMetadata[1:]
	return &tempopb.SearchResponse{
		Metrics: m.metrics,
		Traces:  []*tempopb.TraceSearchMetadata{traceMetadata},
	}, nil
}

func (m *mockStreamer) Header() (metadata.MD, error) {
	panic("implement me")
}

func (m *mockStreamer) Trailer() metadata.MD {
	panic("implement me")
}

func (m *mockStreamer) CloseSend() error {
	panic("implement me")
}

func (m *mockStreamer) Context() context.Context {
	panic("implement me")
}

func (m *mockStreamer) SendMsg(a any) error {
	panic("implement me")
}

func (m *mockStreamer) RecvMsg(a any) error {
	panic("implement me")
}
