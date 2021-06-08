package notifiers

import (
	"github.com/liubo0127/grafana/pkg/models"
	"github.com/liubo0127/grafana/pkg/services/alerting"
	"reflect"
	"testing"
)

func TestWeComRobotNotifier_Notify(t *testing.T) {
	type fields struct {
		NotifierBase NotifierBase
		Webhook      string
		log          Logger
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
			w := &WeComRobotNotifier{
				NotifierBase: tt.fields.NotifierBase,
				Webhook:      tt.fields.Webhook,
				log:          tt.fields.log,
			}
			if err := w.Notify(tt.args.evalContext); (err != nil) != tt.wantErr {
				t.Errorf("Notify() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func Test_newWeComRobotNotifier(t *testing.T) {
	type args struct {
		model *models.AlertNotification
	}
	tests := []struct {
		name    string
		args    args
		want    Notifier
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := newWeComRobotNotifier(tt.args.model)
			if (err != nil) != tt.wantErr {
				t.Errorf("newWeComRobotNotifier() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("newWeComRobotNotifier() got = %v, want %v", got, tt.want)
			}
		})
	}
}
