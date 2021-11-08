package pipeline

import (
	"context"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
)

type BuiltinRuleBuilder struct {
	Node                 *centrifuge.Node
	ManagedStream        *managedstream.Runner
	FrameStorage         *FrameStorage
	Storage              Storage
	ChannelHandlerGetter ChannelHandlerGetter
	EncryptionService    encryption.Service
}

func (b *BuiltinRuleBuilder) BuildRules(ctx context.Context, orgID int64) ([]*LiveChannelRule, error) {
	return []*LiveChannelRule{
		{
			OrgId:   orgID,
			Pattern: "stream/*rest",
			Subscribers: []Subscriber{
				NewManagedStreamSubscriber(b.ManagedStream),
			},
			Converter: NewAutoInfluxConverter(AutoInfluxConverterConfig{
				FrameFormat: "labels_column",
			}),
			FrameOutputters: []FrameOutputter{
				NewManagedStreamFrameOutput(b.ManagedStream),
			},
		},
		{
			OrgId:   orgID,
			Pattern: "plugin/*rest",
			Subscribers: []Subscriber{
				NewBuiltinSubscriber(b.ChannelHandlerGetter),
			},
			DataOutputters: []DataOutputter{
				NewLocalSubscribersDataOutput(b.Node),
			},
		},
		{
			OrgId:   orgID,
			Pattern: "ds/*rest",
			Subscribers: []Subscriber{
				NewBuiltinSubscriber(b.ChannelHandlerGetter),
			},
			DataOutputters: []DataOutputter{
				NewLocalSubscribersDataOutput(b.Node),
			},
		},
		{
			OrgId:   orgID,
			Pattern: "grafana/broadcast/*rest",
			Subscribers: []Subscriber{
				NewBuiltinSubscriber(b.ChannelHandlerGetter),
			},
			DataOutputters: []DataOutputter{
				NewBuiltinDataOutput(b.ChannelHandlerGetter),
			},
		},
		{
			OrgId:   orgID,
			Pattern: "grafana/dashboard/*rest",
			Subscribers: []Subscriber{
				NewBuiltinSubscriber(b.ChannelHandlerGetter),
			},
			DataOutputters: []DataOutputter{
				NewBuiltinDataOutput(b.ChannelHandlerGetter),
			},
		},
	}, nil
}
