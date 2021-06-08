package notifiers

import (
	"github.com/liubo0127/grafana/pkg/services/alerting"
	"reflect"
	"testing"
)

func TestWeComNotifier_GetAccessToken(t *testing.T) {
	type fields struct {
		NotifierBase NotifierBase
		AgentId      string
		CorpId       string
		Secret       string
		UserId       string
		DepartmentId string
		log          Logger
	}
	tests := []struct {
		name    string
		fields  fields
		want    string
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := &WeComNotifier{
				NotifierBase: tt.fields.NotifierBase,
				AgentId:      tt.fields.AgentId,
				CorpId:       tt.fields.CorpId,
				Secret:       tt.fields.Secret,
				UserId:       tt.fields.UserId,
				DepartmentId: tt.fields.DepartmentId,
				log:          tt.fields.log,
			}
			got, err := w.GetAccessToken()
			if (err != nil) != tt.wantErr {
				t.Errorf("GetAccessToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("GetAccessToken() got = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestWeComNotifier_GetMediaId(t *testing.T) {
	type fields struct {
		NotifierBase NotifierBase
		AgentId      string
		CorpId       string
		Secret       string
		UserId       string
		DepartmentId string
		log          Logger
	}
	type args struct {
		path  string
		token string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    string
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := &WeComNotifier{
				NotifierBase: tt.fields.NotifierBase,
				AgentId:      tt.fields.AgentId,
				CorpId:       tt.fields.CorpId,
				Secret:       tt.fields.Secret,
				UserId:       tt.fields.UserId,
				DepartmentId: tt.fields.DepartmentId,
				log:          tt.fields.log,
			}
			got, err := w.GetMediaId(tt.args.path, tt.args.token)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetMediaId() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("GetMediaId() got = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestWeComNotifier_Notify(t *testing.T) {
	type fields struct {
		NotifierBase NotifierBase
		AgentId      string
		CorpId       string
		Secret       string
		UserId       string
		DepartmentId string
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
			w := &WeComNotifier{
				NotifierBase: tt.fields.NotifierBase,
				AgentId:      tt.fields.AgentId,
				CorpId:       tt.fields.CorpId,
				Secret:       tt.fields.Secret,
				UserId:       tt.fields.UserId,
				DepartmentId: tt.fields.DepartmentId,
				log:          tt.fields.log,
			}
			if err := w.Notify(tt.args.evalContext); (err != nil) != tt.wantErr {
				t.Errorf("Notify() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestWeComNotifier_PushImage(t *testing.T) {
	type fields struct {
		NotifierBase NotifierBase
		AgentId      string
		CorpId       string
		Secret       string
		UserId       string
		DepartmentId string
		log          Logger
	}
	type args struct {
		evalContext *alerting.EvalContext
		token       string
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
			w := &WeComNotifier{
				NotifierBase: tt.fields.NotifierBase,
				AgentId:      tt.fields.AgentId,
				CorpId:       tt.fields.CorpId,
				Secret:       tt.fields.Secret,
				UserId:       tt.fields.UserId,
				DepartmentId: tt.fields.DepartmentId,
				log:          tt.fields.log,
			}
			if err := w.PushImage(tt.args.evalContext, tt.args.token); (err != nil) != tt.wantErr {
				t.Errorf("PushImage() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func Test_newWeComNotifier(t *testing.T) {
	type args struct {
		model *m.AlertNotification
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
			got, err := newWeComNotifier(tt.args.model)
			if (err != nil) != tt.wantErr {
				t.Errorf("newWeComNotifier() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("newWeComNotifier() got = %v, want %v", got, tt.want)
			}
		})
	}
}
