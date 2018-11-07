package notifiers

import (
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sns"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "aws_sns",
		Name:        "AWS SNS",
		Description: "Sends HTTP POST request to a AWS SNS API",
		Factory:     NewAwsSnsNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">AWS SNS settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">Region</span>
        <input type="text" required class="gf-form-input max-width-14" ng-model="ctrl.model.settings.region" placeholder="us-east-1"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Topic Arn</span>
				<input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.topic_arn" placeholder="arn:aws:sns:us-east-1:123456789012:topic"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Access Key</span>
        <input type="text" class="gf-form-input max-width-14" ng-model="ctrl.model.settings.access_key"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Secret Key</span>
        <input type="text" class="gf-form-input max-width-14" ng-model="ctrl.model.settings.secret_key"></input>
      </div>
    `,
	})
}

func NewAwsSnsNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	region := model.Settings.Get("region").MustString()
	if region == "" {
		return nil, alerting.ValidationError{Reason: "Could not find region property in settings"}
	}

	topicArn := model.Settings.Get("topic_arn").MustString()
	if topicArn == "" {
		return nil, alerting.ValidationError{Reason: "Could not find topic arn property in settings"}
	}

	return &AwsSnsNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Region:       region,
		TopicArn:     topicArn,
		AccessKey:    model.Settings.Get("access_key").MustString(),
		SecretKey:    model.Settings.Get("secret_key").MustString(),
		log:          log.New("alerting.notifier.aws_sns"),
	}, nil
}

type AwsSnsNotifier struct {
	NotifierBase
	Region    string
	TopicArn  string
	AccessKey string
	SecretKey string
	log       log.Logger
}

func (this *AwsSnsNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending AWS SNS message")
	metrics.M_Alerting_Notification_Sent_AwsSns.Inc(1)

	bodyJSON := simplejson.New()
	bodyJSON.Set("title", evalContext.GetNotificationTitle())
	bodyJSON.Set("ruleId", evalContext.Rule.Id)
	bodyJSON.Set("ruleName", evalContext.Rule.Name)
	bodyJSON.Set("state", evalContext.Rule.State)
	bodyJSON.Set("evalMatches", simplejson.NewFromAny(evalContext.EvalMatches))

	ruleUrl, err := evalContext.GetRuleUrl()
	if err == nil {
		bodyJSON.Set("ruleUrl", ruleUrl)
	}

	if evalContext.ImagePublicUrl != "" {
		bodyJSON.Set("imageUrl", evalContext.ImagePublicUrl)
	}

	if evalContext.Rule.Message != "" {
		bodyJSON.Set("message", evalContext.Rule.Message)
	}
	bodyJSON.Set("default", "")

	body, _ := bodyJSON.MarshalJSON()

	sess, err := session.NewSession()
	if err != nil {
		return err
	}
	creds := credentials.NewChainCredentials(
		[]credentials.Provider{
			&credentials.StaticProvider{Value: credentials.Value{
				AccessKeyID:     this.AccessKey,
				SecretAccessKey: this.SecretKey,
			}},
			&credentials.EnvProvider{},
			&ec2rolecreds.EC2RoleProvider{Client: ec2metadata.New(sess), ExpiryWindow: 5 * time.Minute},
		})
	cfg := &aws.Config{
		Region:      aws.String(this.Region),
		Credentials: creds,
	}

	svc := sns.New(sess, cfg)
	params := &sns.PublishInput{
		Subject:  aws.String(evalContext.GetNotificationTitle()),
		Message:  aws.String(string(body)),
		TopicArn: aws.String(this.TopicArn),
	}

	if _, err = svc.Publish(params); err != nil {
		this.log.Error("Failed to send AWS SNS event", "error", err)
		return err
	}

	return nil
}
