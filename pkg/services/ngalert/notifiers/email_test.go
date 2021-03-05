package notifiers

import (
	"context"
	"io/ioutil"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

func TestGenerateEmailMessage(t *testing.T) {
	alerts := []*types.Alert{
		{
			Alert: model.Alert{
				Labels:       model.LabelSet{"alertname": "foobar"},
				Annotations:  model.LabelSet{"msg": "foo is in the bar"},
				StartsAt:     time.Now(),
				EndsAt:       time.Now().Add(time.Hour),
				GeneratorURL: "http://prometheus:9090/graph?something_foo_bar",
			},
			UpdatedAt: time.Now(),
		}, {
			Alert: model.Alert{
				Labels:       model.LabelSet{"alertname": "updown"},
				Annotations:  model.LabelSet{"msg": "It's down!"},
				StartsAt:     time.Unix(100, 0),
				EndsAt:       time.Unix(200, 0),
				GeneratorURL: "http://prometheus:9090/graph?something_up_down",
			},
			UpdatedAt: time.Unix(100, 0),
		},
	}

	Convey("Generate email message", t, func() {
		settings, err := simplejson.NewJson([]byte(`{
			"addresses": "test@example.com",
			"singleEmail": false
		}`))
		So(err, ShouldBeNil)
		cfg := &models.AlertNotification{
			Settings: settings,
		}

		emailNotifier, err := NewEmailNotifier(cfg, nil)
		So(err, ShouldBeNil)

		msg, err := emailNotifier.generateEmailMessage(context.Background(), alerts)
		So(err, ShouldBeNil)
		So(msg, ShouldNotBeNil)

		expectedBody, err := ioutil.ReadFile("testdata/email_body.html")
		So(err, ShouldBeNil)

		expectedMsg := &notifications.Message{
			To:   []string{"test@example.com"},
			Body: string(expectedBody),
		}
		So(msg, ShouldResemble, expectedMsg)
	})
}
