package notifiers

import (
	"mime/multipart"
	"reflect"
	"testing"

	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func TestNewBMSNotifier(t *testing.T) {
	type args struct {
		model *m.AlertNotification
	}
	tests := []struct {
		name    string
		args    args
		want    alerting.Notifier
		wantErr bool
	}{
	// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewBMSNotifier(tt.args.model)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewBMSNotifier() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("NewBMSNotifier() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBMSNotifier_buildMessage(t *testing.T) {
	type fields struct {
		NotifierBase NotifierBase
		Alphaname    string
		Username     string
		Password     string
		Msisdn       string
		log          log.Logger
	}
	type args struct {
		evalContext *alerting.EvalContext
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		want   *m.SendWebhookSync
	}{
	// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			this := &BMSNotifier{
				NotifierBase: tt.fields.NotifierBase,
				Alphaname:    tt.fields.Alphaname,
				Username:     tt.fields.Username,
				Password:     tt.fields.Password,
				Msisdn:       tt.fields.Msisdn,
				log:          tt.fields.log,
			}
			if got := this.buildMessage(tt.args.evalContext); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("BMSNotifier.buildMessage() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBMSNotifier_generateBMSCmd(t *testing.T) {
	type fields struct {
		NotifierBase NotifierBase
		Alphaname    string
		Username     string
		Password     string
		Msisdn       string
		log          log.Logger
	}
	type args struct {
		message_txt  string
		messageField string
		apiAction    string
		extraConf    func(writer *multipart.Writer)
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		want   *m.SendWebhookSync
	}{
	// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			this := &BMSNotifier{
				NotifierBase: tt.fields.NotifierBase,
				Alphaname:    tt.fields.Alphaname,
				Username:     tt.fields.Username,
				Password:     tt.fields.Password,
				Msisdn:       tt.fields.Msisdn,
				log:          tt.fields.log,
			}
			if got := this.generateBMSCmd(tt.args.message_txt, tt.args.messageField, tt.args.apiAction, tt.args.extraConf); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("BMSNotifier.generateBMSCmd() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_generateMetricsMessageBMS(t *testing.T) {
	type args struct {
		evalContext *alerting.EvalContext
	}
	tests := []struct {
		name string
		args args
		want string
	}{
	// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := generateMetricsMessageBMS(tt.args.evalContext); got != tt.want {
				t.Errorf("generateMetricsMessageBMS() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBMSNotifier_Notify(t *testing.T) {
	type fields struct {
		NotifierBase NotifierBase
		Alphaname    string
		Username     string
		Password     string
		Msisdn       string
		log          log.Logger
	}
	type args struct {
		evalContext *alerting.EvalContext
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr bool
	}{
	// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			this := &BMSNotifier{
				NotifierBase: tt.fields.NotifierBase,
				Alphaname:    tt.fields.Alphaname,
				Username:     tt.fields.Username,
				Password:     tt.fields.Password,
				Msisdn:       tt.fields.Msisdn,
				log:          tt.fields.log,
			}
			if err := this.Notify(tt.args.evalContext); (err != nil) != tt.wantErr {
				t.Errorf("BMSNotifier.Notify() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
