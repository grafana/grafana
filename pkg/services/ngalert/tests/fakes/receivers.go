package fakes

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type ReceiverServiceMethodCall struct {
	Method string
	Args   []interface{}
}

type FakeReceiverService struct {
	MethodCalls     []ReceiverServiceMethodCall
	GetReceiverFn   func(ctx context.Context, q models.GetReceiverQuery, u identity.Requester) (definitions.GettableApiReceiver, error)
	ListReceiversFn func(ctx context.Context, q models.ListReceiversQuery, u identity.Requester) ([]definitions.GettableApiReceiver, error)
}

func NewFakeReceiverService() *FakeReceiverService {
	return &FakeReceiverService{
		GetReceiverFn:   defaultReceiverFn,
		ListReceiversFn: defaultReceiversFn,
	}
}

func (f *FakeReceiverService) GetReceiver(ctx context.Context, q models.GetReceiverQuery, u identity.Requester) (definitions.GettableApiReceiver, error) {
	f.MethodCalls = append(f.MethodCalls, ReceiverServiceMethodCall{Method: "GetReceiver", Args: []interface{}{ctx, q}})
	return f.GetReceiverFn(ctx, q, u)
}

func (f *FakeReceiverService) ListReceivers(ctx context.Context, q models.ListReceiversQuery, u identity.Requester) ([]definitions.GettableApiReceiver, error) {
	f.MethodCalls = append(f.MethodCalls, ReceiverServiceMethodCall{Method: "ListReceivers", Args: []interface{}{ctx, q}})
	return f.ListReceiversFn(ctx, q, u)
}

func (f *FakeReceiverService) PopMethodCall() ReceiverServiceMethodCall {
	if len(f.MethodCalls) == 0 {
		return ReceiverServiceMethodCall{}
	}
	call := f.MethodCalls[len(f.MethodCalls)-1]
	f.MethodCalls = f.MethodCalls[:len(f.MethodCalls)-1]
	return call
}

func (f *FakeReceiverService) Reset() {
	f.MethodCalls = nil
	f.GetReceiverFn = defaultReceiverFn
	f.ListReceiversFn = defaultReceiversFn
}

func defaultReceiverFn(ctx context.Context, q models.GetReceiverQuery, u identity.Requester) (definitions.GettableApiReceiver, error) {
	return definitions.GettableApiReceiver{}, nil
}

func defaultReceiversFn(ctx context.Context, q models.ListReceiversQuery, u identity.Requester) ([]definitions.GettableApiReceiver, error) {
	return nil, nil
}
