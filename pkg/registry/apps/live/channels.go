package live

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/live"

	livev1 "github.com/grafana/grafana/apps/live/pkg/apis/live/v1alpha1"
	"github.com/grafana/grafana/apps/live/pkg/managedstream"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// ChannelLister lists the managed stream channels that are active in a namespace.
type ChannelLister interface {
	ListManagedChannels(ctx context.Context, namespace string) ([]*managedstream.ManagedChannel, error)
}

var (
	_ rest.Storage              = (*channelStorage)(nil)
	_ rest.Scoper               = (*channelStorage)(nil)
	_ rest.SingularNameProvider = (*channelStorage)(nil)
	_ rest.Getter               = (*channelStorage)(nil)
	_ rest.Lister               = (*channelStorage)(nil)
)

// channelStorage serves Channels from the Live node. It is read-only and
// stores nothing.
type channelStorage struct {
	channels       ChannelLister
	tableConverter rest.TableConvertor
}

func newChannelStorage(channels ChannelLister) *channelStorage {
	gr := livev1.ChannelKind().GroupVersionResource().GroupResource()
	return &channelStorage{
		channels: channels,
		tableConverter: utils.NewTableConverter(gr, utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Path", Type: "string"},
				{Name: "Minute Rate", Type: "integer"},
			},
			Reader: func(obj any) ([]any, error) {
				c, ok := obj.(*livev1.Channel)
				if !ok {
					return nil, fmt.Errorf("expected Channel, got %T", obj)
				}
				return []any{c.Name, c.Spec.Path, c.Status.MinuteRate}, nil
			},
		}),
	}
}

func (s *channelStorage) New() runtime.Object { return livev1.NewChannel() }

func (s *channelStorage) NewList() runtime.Object { return &livev1.ChannelList{} }

func (s *channelStorage) Destroy() {}

func (s *channelStorage) NamespaceScoped() bool { return true }

func (s *channelStorage) GetSingularName() string {
	return strings.ToLower(livev1.ChannelKind().Kind())
}

func (s *channelStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *channelStorage) List(ctx context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	managed, err := s.channels.ListManagedChannels(ctx, ns.Value)
	if err != nil {
		return nil, err
	}
	list := &livev1.ChannelList{Items: make([]livev1.Channel, 0, len(managed))}
	for _, m := range managed {
		// A channel outside the Live grammar cannot be subscribed to, and its
		// name might not map back to a single path.
		if _, err := live.ParseChannel(m.Channel); err != nil {
			continue
		}
		c, err := toChannel(ns.Value, m)
		if err != nil {
			return nil, err
		}
		list.Items = append(list.Items, *c)
	}
	return list, nil
}

func (s *channelStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	obj, err := s.List(ctx, nil)
	if err != nil {
		return nil, err
	}
	for i, c := range obj.(*livev1.ChannelList).Items {
		if c.Name == name {
			return &obj.(*livev1.ChannelList).Items[i], nil
		}
	}
	return nil, apierrors.NewNotFound(livev1.ChannelKind().GroupVersionResource().GroupResource(), name)
}

// channelName turns a channel path into an object name, which cannot contain
// slashes: "/" becomes "." and a literal "." becomes "~". A valid Live channel
// never contains "~", so different paths always get different names.
func channelName(path string) string {
	return channelNameReplacer.Replace(path)
}

var channelNameReplacer = strings.NewReplacer(".", "~", "/", ".")

func toChannel(namespace string, m *managedstream.ManagedChannel) (*livev1.Channel, error) {
	c := livev1.NewChannel()
	c.Name = channelName(m.Channel)
	c.Namespace = namespace
	c.Spec.Path = m.Channel
	c.Status.MinuteRate = m.MinuteRate
	if len(m.Data) > 0 && string(m.Data) != "null" {
		if err := json.Unmarshal(m.Data, &c.Status.Data); err != nil {
			return nil, fmt.Errorf("decoding schema of channel %q: %w", m.Channel, err)
		}
	}
	return c, nil
}
