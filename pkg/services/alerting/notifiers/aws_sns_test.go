package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAwsSnsNotifier(t *testing.T) {
	Convey("AwsSns notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "aws_sns",
					Type:     "aws_sns",
					Settings: settingsJSON,
				}

				_, err := NewAwsSnsNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
					"region": "us-east-1",
					"topic_arn": "arn:aws:sns:us-east-1:123456789012:topic"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "AWS SNS",
					Type:     "aws_sns",
					Settings: settingsJSON,
				}

				not, err := NewAwsSnsNotifier(model)
				aws_snsNotifier := not.(*AwsSnsNotifier)

				So(err, ShouldBeNil)
				So(aws_snsNotifier.Name, ShouldEqual, "AWS SNS")
				So(aws_snsNotifier.Type, ShouldEqual, "aws_sns")
				So(aws_snsNotifier.Region, ShouldEqual, "us-east-1")
				So(aws_snsNotifier.TopicArn, ShouldEqual, "arn:aws:sns:us-east-1:123456789012:topic")
			})
		})
	})
}
