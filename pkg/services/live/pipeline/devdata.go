package pipeline

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/services/live/managedstream"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Data struct {
	Value1     float64                `json:"value1"`
	Value2     float64                `json:"value2"`
	Value3     *float64               `json:"value3"`
	Value4     float64                `json:"value4"`
	Annotation string                 `json:"annotation"`
	Array      []float64              `json:"array"`
	Map        map[string]interface{} `json:"map"`
	Host       string                 `json:"host"`
	Status     string                 `json:"status"`
}

// TODO: temporary for development, remove.
func postTestData() {
	i := 0
	for {
		time.Sleep(1000 * time.Millisecond)
		num1 := rand.Intn(10)
		num2 := rand.Intn(10)
		d := Data{
			Value1:     float64(num1),
			Value2:     float64(num2),
			Value4:     float64(i % 10),
			Annotation: "odd",
			Array:      []float64{float64(rand.Intn(10)), float64(rand.Intn(10))},
			Map: map[string]interface{}{
				"red":    1,
				"yellow": 4,
				"green":  7,
			},
			Host:   "macbook-local",
			Status: "running",
		}
		if i%2 != 0 {
			val := 4.0
			d.Value3 = &val
		}
		if i%2 == 0 {
			val := 3.0
			d.Value3 = &val
			d.Annotation = "even"
		}
		if i%10 == 0 {
			d.Value3 = nil
		}
		jsonData, _ := json.Marshal(d)
		log.Println(string(jsonData))

		req, _ := http.NewRequest("POST", "http://localhost:3000/api/live/pipeline/push/stream/json/auto", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+os.Getenv("GF_TOKEN"))
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		_ = resp.Body.Close()
		req, _ = http.NewRequest("POST", "http://localhost:3000/api/live/push/pipeline/push/stream/json/tip", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+os.Getenv("GF_TOKEN"))
		resp, err = http.DefaultClient.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		_ = resp.Body.Close()
		req, _ = http.NewRequest("POST", "http://localhost:3000/api/live/pipeline/push/stream/json/exact", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+os.Getenv("GF_TOKEN"))
		resp, err = http.DefaultClient.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		_ = resp.Body.Close()
		i++
	}
}

type DevRuleBuilder struct {
	Node                 *centrifuge.Node
	ManagedStream        *managedstream.Runner
	FrameStorage         *FrameStorage
	ChannelHandlerGetter ChannelHandlerGetter
}

func (f *DevRuleBuilder) BuildRules(_ context.Context, _ int64) ([]*LiveChannelRule, error) {
	return []*LiveChannelRule{
		{
			Pattern: "plugin/testdata/random-20Hz-stream",
			DataOutputters: []DataOutputter{
				NewLokiDataOutput(
					os.Getenv("GF_LIVE_LOKI_ENDPOINT"),
					&BasicAuth{
						User:     os.Getenv("GF_LIVE_LOKI_USER"),
						Password: os.Getenv("GF_LIVE_LOKI_PASSWORD"),
					},
				),
			},
			Converter: NewJsonFrameConverter(JsonFrameConverterConfig{}),
			FrameOutputters: []FrameOutputter{
				NewManagedStreamFrameOutput(f.ManagedStream),
				NewRemoteWriteFrameOutput(
					os.Getenv("GF_LIVE_REMOTE_WRITE_ENDPOINT"),
					&BasicAuth{
						User:     os.Getenv("GF_LIVE_REMOTE_WRITE_USER"),
						Password: os.Getenv("GF_LIVE_REMOTE_WRITE_PASSWORD"),
					},
					1000,
				),
			},
			Subscribers: []Subscriber{
				NewBuiltinSubscriber(f.ChannelHandlerGetter),
				NewManagedStreamSubscriber(f.ManagedStream),
			},
		},
		{
			Pattern: "stream/testdata/random-20Hz-stream",
			FrameProcessors: []FrameProcessor{
				NewKeepFieldsFrameProcessor(KeepFieldsFrameProcessorConfig{
					FieldNames: []string{"Time", "Min", "Max"},
				}),
			},
			FrameOutputters: []FrameOutputter{
				NewManagedStreamFrameOutput(f.ManagedStream),
			},
		},
		{
			OrgId:   1,
			Pattern: "stream/influx/input",
			Converter: NewAutoInfluxConverter(AutoInfluxConverterConfig{
				FrameFormat: "labels_column",
			}),
		},
		{
			OrgId:   1,
			Pattern: "stream/influx/input/:rest",
			FrameOutputters: []FrameOutputter{
				NewManagedStreamFrameOutput(f.ManagedStream),
			},
		},
		{
			OrgId:   1,
			Pattern: "stream/influx/input/cpu",
			// TODO: Would be fine to have KeepLabelsProcessor, but we need to know frame type
			// since there are cases when labels attached to a field, and cases where labels
			// set in a first frame column (in Influx converter). For example, this will allow
			// to leave only "total-cpu" data while dropping individual CPUs.
			FrameProcessors: []FrameProcessor{
				NewKeepFieldsFrameProcessor(KeepFieldsFrameProcessorConfig{
					FieldNames: []string{"labels", "time", "usage_user"},
				}),
			},
			FrameOutputters: []FrameOutputter{
				NewManagedStreamFrameOutput(f.ManagedStream),
				NewConditionalOutput(
					NewFrameNumberCompareCondition("usage_user", "gte", 50),
					NewRedirectFrameOutput(RedirectOutputConfig{
						Channel: "stream/influx/input/cpu/spikes",
					}),
				),
			},
		},
		{
			OrgId:           1,
			Pattern:         "stream/influx/input/cpu/spikes",
			FrameOutputters: []FrameOutputter{NewManagedStreamFrameOutput(f.ManagedStream)},
		},
		{
			OrgId:           1,
			Pattern:         "stream/json/auto",
			Converter:       NewAutoJsonConverter(AutoJsonConverterConfig{}),
			FrameOutputters: []FrameOutputter{NewManagedStreamFrameOutput(f.ManagedStream)},
		},
		{
			OrgId:   1,
			Pattern: "stream/json/tip",
			Converter: NewAutoJsonConverter(AutoJsonConverterConfig{
				FieldTips: map[string]Field{
					"value3": {
						Name: "value3",
						Type: data.FieldTypeNullableFloat64,
					},
					"value100": {
						Name: "value100",
						Type: data.FieldTypeNullableFloat64,
					},
				},
			}),
			FrameProcessors: []FrameProcessor{
				NewDropFieldsFrameProcessor(DropFieldsFrameProcessorConfig{
					FieldNames: []string{"value2"},
				}),
			},
			FrameOutputters: []FrameOutputter{
				NewManagedStreamFrameOutput(f.ManagedStream),
			},
		},
		{
			OrgId:   1,
			Pattern: "stream/json/exact",
			Converter: NewExactJsonConverter(ExactJsonConverterConfig{
				Fields: []Field{
					{
						Name:  "time",
						Type:  data.FieldTypeTime,
						Value: "#{now}",
					},
					{
						Name:  "value1",
						Type:  data.FieldTypeNullableFloat64,
						Value: "$.value1",
					},
					{
						Name:  "value2",
						Type:  data.FieldTypeNullableFloat64,
						Value: "$.value2",
					},
					{
						Name:  "value3",
						Type:  data.FieldTypeNullableFloat64,
						Value: "$.value3",
						Labels: []Label{
							{
								Name:  "host",
								Value: "$.host",
							},
						},
					},
					{
						Name:  "value4",
						Type:  data.FieldTypeNullableFloat64,
						Value: "$.value4",
						Config: &data.FieldConfig{
							Thresholds: &data.ThresholdsConfig{
								Mode: data.ThresholdsModeAbsolute,
								Steps: []data.Threshold{
									{
										Value: 2,
										State: "normal",
										Color: "green",
									},
									{
										Value: 6,
										State: "warning",
										Color: "orange",
									},
									{
										Value: 8,
										State: "critical",
										Color: "red",
									},
								},
							},
						},
					},
					{
						Name:  "map.red",
						Type:  data.FieldTypeNullableFloat64,
						Value: "$.map.red",
						Labels: []Label{
							{
								Name:  "host",
								Value: "$.host",
							},
							{
								Name:  "host2",
								Value: "$.host",
							},
						},
					},
					{
						Name:  "annotation",
						Type:  data.FieldTypeNullableString,
						Value: "$.annotation",
					},
					{
						Name:  "running",
						Type:  data.FieldTypeNullableBool,
						Value: "{x.status === 'running'}",
					},
					{
						Name:  "num_map_colors",
						Type:  data.FieldTypeNullableFloat64,
						Value: "{Object.keys(x.map).length}",
					},
				},
			}),
			FrameOutputters: []FrameOutputter{
				NewManagedStreamFrameOutput(f.ManagedStream),
				NewRemoteWriteFrameOutput(
					os.Getenv("GF_LIVE_REMOTE_WRITE_ENDPOINT"),
					&BasicAuth{
						User:     os.Getenv("GF_LIVE_REMOTE_WRITE_USER"),
						Password: os.Getenv("GF_LIVE_REMOTE_WRITE_PASSWORD"),
					},
					0,
				),
				NewChangeLogFrameOutput(f.FrameStorage, ChangeLogOutputConfig{
					FieldName: "value3",
					Channel:   "stream/json/exact/value3/changes",
				}),
				NewChangeLogFrameOutput(f.FrameStorage, ChangeLogOutputConfig{
					FieldName: "annotation",
					Channel:   "stream/json/exact/annotation/changes",
				}),
				NewConditionalOutput(
					NewMultipleFrameConditionChecker(
						ConditionAll,
						NewFrameNumberCompareCondition("value1", "gte", 3.0),
						NewFrameNumberCompareCondition("value2", "gte", 3.0),
					),
					NewRedirectFrameOutput(RedirectOutputConfig{
						Channel: "stream/json/exact/condition",
					}),
				),
				NewThresholdOutput(f.FrameStorage, ThresholdOutputConfig{
					FieldName: "value4",
					Channel:   "stream/json/exact/value4/state",
				}),
			},
		},
		{
			OrgId:   1,
			Pattern: "stream/json/exact/value3/changes",
			FrameOutputters: []FrameOutputter{
				NewManagedStreamFrameOutput(f.ManagedStream),
				NewRemoteWriteFrameOutput(
					os.Getenv("GF_LIVE_REMOTE_WRITE_ENDPOINT"),
					&BasicAuth{
						User:     os.Getenv("GF_LIVE_REMOTE_WRITE_USER"),
						Password: os.Getenv("GF_LIVE_REMOTE_WRITE_PASSWORD"),
					},
					0,
				),
			},
		},
		{
			OrgId:   1,
			Pattern: "stream/json/exact/annotation/changes",
			FrameOutputters: []FrameOutputter{
				NewManagedStreamFrameOutput(f.ManagedStream),
			},
		},
		{
			OrgId:   1,
			Pattern: "stream/json/exact/condition",
			FrameOutputters: []FrameOutputter{
				NewManagedStreamFrameOutput(f.ManagedStream),
			},
		},
		{
			OrgId:   1,
			Pattern: "stream/json/exact/value4/state",
			FrameOutputters: []FrameOutputter{
				NewManagedStreamFrameOutput(f.ManagedStream),
			},
		},
	}, nil
}
