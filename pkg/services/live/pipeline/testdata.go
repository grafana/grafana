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

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
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

		req, _ := http.NewRequest("POST", "http://localhost:3000/api/live/push/json/auto", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+os.Getenv("GF_TOKEN"))
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		_ = resp.Body.Close()
		req, _ = http.NewRequest("POST", "http://localhost:3000/api/live/push/json/tip", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+os.Getenv("GF_TOKEN"))
		resp, err = http.DefaultClient.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		_ = resp.Body.Close()
		req, _ = http.NewRequest("POST", "http://localhost:3000/api/live/push/json/exact", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+os.Getenv("GF_TOKEN"))
		resp, err = http.DefaultClient.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		_ = resp.Body.Close()
		i++
	}
}

type hardcodedStorage struct {
	managedStream *managedstream.Runner
	frameStorage  *FrameStorage
	pipeline      *Pipeline
}

func (f *hardcodedStorage) ListChannelRules(_ context.Context, _ ListLiveChannelRuleCommand) ([]*LiveChannelRule, error) {
	return []*LiveChannelRule{
		{
			Pattern:   "plugin/testdata/random-20Hz-stream",
			Converter: NewJsonFrameConverter(JsonFrameConverterConfig{}),
			Outputter: NewMultipleOutputter(
				NewManagedStreamOutput(f.managedStream),
				NewRedirectOutput(f.pipeline, RedirectOutputConfig{
					Channel: "stream/testdata/random-20Hz-stream",
				}),
			),
		},
		{
			Pattern: "stream/testdata/random-20Hz-stream",
			Processor: NewKeepFieldsProcessor(KeepFieldsProcessorConfig{
				FieldNames: []string{"Time", "Min", "Max"},
			}),
			Outputter: NewManagedStreamOutput(f.managedStream),
		},
		{
			OrgId:   1,
			Pattern: "stream/influx/input",
			Converter: NewAutoInfluxConverter(AutoInfluxConverterConfig{
				FrameFormat: "labels_column",
			}),
		},
		{
			OrgId:     1,
			Pattern:   "stream/influx/input/:rest",
			Outputter: NewManagedStreamOutput(f.managedStream),
		},
		{
			OrgId:   1,
			Pattern: "stream/influx/input/cpu",
			// TODO: Would be fine to have KeepLabelsProcessor, but we need to know frame type
			// since there are cases when labels attached to a field, and cases where labels
			// set in a first frame column (in Influx converter). For example, this will allow
			// to leave only "total-cpu" data while dropping individual CPUs.
			Processor: NewKeepFieldsProcessor(KeepFieldsProcessorConfig{
				FieldNames: []string{"labels", "time", "usage_user"},
			}),
			Outputter: NewMultipleOutputter(
				NewManagedStreamOutput(f.managedStream),
				NewConditionalOutput(
					NewNumberCompareCondition("usage_user", "gte", 50),
					NewRedirectOutput(f.pipeline, RedirectOutputConfig{
						Channel: "stream/influx/input/cpu/spikes",
					}),
				),
			),
		},
		{
			OrgId:     1,
			Pattern:   "stream/influx/input/cpu/spikes",
			Outputter: NewManagedStreamOutput(f.managedStream),
		},
		{
			OrgId:     1,
			Pattern:   "stream/json/auto",
			Converter: NewAutoJsonConverter(AutoJsonConverterConfig{}),
			Outputter: NewManagedStreamOutput(f.managedStream),
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
			Processor: NewDropFieldsProcessor(DropFieldsProcessorConfig{
				FieldNames: []string{"value2"},
			}),
			Outputter: NewManagedStreamOutput(f.managedStream),
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
									},
									{
										Value: 6,
										State: "warning",
									},
									{
										Value: 8,
										State: "critical",
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
			Outputter: NewMultipleOutputter(
				NewManagedStreamOutput(f.managedStream),
				NewRemoteWriteOutput(RemoteWriteConfig{
					Endpoint: os.Getenv("GF_LIVE_REMOTE_WRITE_ENDPOINT"),
					User:     os.Getenv("GF_LIVE_REMOTE_WRITE_USER"),
					Password: os.Getenv("GF_LIVE_REMOTE_WRITE_PASSWORD"),
				}),
				NewChangeLogOutput(f.frameStorage, f.pipeline, ChangeLogOutputConfig{
					FieldName: "value3",
					Channel:   "stream/json/exact/value3/changes",
				}),
				NewChangeLogOutput(f.frameStorage, f.pipeline, ChangeLogOutputConfig{
					FieldName: "annotation",
					Channel:   "stream/json/exact/annotation/changes",
				}),
				NewConditionalOutput(
					NewMultipleConditionChecker(
						ConditionAll,
						NewNumberCompareCondition("value1", "gte", 3.0),
						NewNumberCompareCondition("value2", "gte", 3.0),
					),
					NewRedirectOutput(f.pipeline, RedirectOutputConfig{
						Channel: "stream/json/exact/condition",
					}),
				),
				NewThresholdOutput(f.frameStorage, f.pipeline, ThresholdOutputConfig{
					FieldName: "value4",
					Channel:   "stream/json/exact/value4/state",
				}),
			),
		},
		{
			OrgId:   1,
			Pattern: "stream/json/exact/value3/changes",
			Outputter: NewMultipleOutputter(
				NewManagedStreamOutput(f.managedStream),
				NewRemoteWriteOutput(RemoteWriteConfig{
					Endpoint: os.Getenv("GF_LIVE_REMOTE_WRITE_ENDPOINT"),
					User:     os.Getenv("GF_LIVE_REMOTE_WRITE_USER"),
					Password: os.Getenv("GF_LIVE_REMOTE_WRITE_PASSWORD"),
				}),
			),
		},
		{
			OrgId:     1,
			Pattern:   "stream/json/exact/annotation/changes",
			Outputter: NewManagedStreamOutput(f.managedStream),
		},
		{
			OrgId:     1,
			Pattern:   "stream/json/exact/condition",
			Outputter: NewManagedStreamOutput(f.managedStream),
		},
		{
			OrgId:     1,
			Pattern:   "stream/json/exact/value4/state",
			Outputter: NewManagedStreamOutput(f.managedStream),
		},
	}, nil
}
