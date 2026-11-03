package collections

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"

	collections "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
)

func ptr(s string) *string { return &s }

func validSlideshow() *collections.Slideshow {
	return &collections.Slideshow{
		ObjectMeta: metav1.ObjectMeta{Name: "noc-wall", Namespace: "default"},
		Spec: collections.SlideshowSpec{
			Title:    "NOC wall",
			Interval: "5m",
			Items: []collections.SlideshowItem{
				{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "cpu", Interval: ptr("30s")},
				{Group: "assistant.ext.grafana.app", Resource: "pages", Name: "p1"},
			},
		},
	}
}

func validate(t *testing.T, op admission.Operation, obj runtime.Object) error {
	t.Helper()
	b := &APIBuilder{}
	attrs := admission.NewAttributesRecord(obj, nil,
		collections.SlideshowResourceInfo.GroupVersionKind(), "default", "noc-wall",
		collections.SlideshowResourceInfo.GroupVersionResource(), "", op, nil, false, nil)
	return b.Validate(context.Background(), attrs, nil)
}

func TestSlideshowValidation(t *testing.T) {
	t.Run("accepts a valid slideshow on create and update", func(t *testing.T) {
		require.NoError(t, validate(t, admission.Create, validSlideshow()))
		require.NoError(t, validate(t, admission.Update, validSlideshow()))
	})

	t.Run("does not look at deletes", func(t *testing.T) {
		require.NoError(t, validate(t, admission.Delete, &collections.Slideshow{}))
	})

	t.Run("accepts exactly 500 items", func(t *testing.T) {
		s := validSlideshow()
		s.Spec.Items = make([]collections.SlideshowItem, 500)
		for i := range s.Spec.Items {
			s.Spec.Items[i] = collections.SlideshowItem{Group: "g", Resource: "r", Name: fmt.Sprintf("n%d", i)}
		}
		require.NoError(t, validate(t, admission.Create, s))
	})

	tests := []struct {
		name   string
		mutate func(s *collections.Slideshow)
		err    string
	}{
		{"empty title", func(s *collections.Slideshow) { s.Spec.Title = "" }, "spec.title"},
		{"blank title", func(s *collections.Slideshow) { s.Spec.Title = "   " }, "spec.title"},
		{"missing interval", func(s *collections.Slideshow) { s.Spec.Interval = "" }, "spec.interval"},
		{"unparseable interval", func(s *collections.Slideshow) { s.Spec.Interval = "soon" }, "spec.interval"},
		{"interval under ten seconds", func(s *collections.Slideshow) { s.Spec.Interval = "9s" }, "spec.interval"},
		{"empty group", func(s *collections.Slideshow) { s.Spec.Items[0].Group = "" }, "spec.items[0].group"},
		{"empty resource", func(s *collections.Slideshow) { s.Spec.Items[1].Resource = "" }, "spec.items[1].resource"},
		{"empty name", func(s *collections.Slideshow) { s.Spec.Items[0].Name = "" }, "spec.items[0].name"},
		{"bad item interval", func(s *collections.Slideshow) { s.Spec.Items[0].Interval = ptr("x") }, "spec.items[0].interval"},
		{"item interval under ten seconds", func(s *collections.Slideshow) { s.Spec.Items[0].Interval = ptr("5s") }, "spec.items[0].interval"},
		{"too many items", func(s *collections.Slideshow) {
			s.Spec.Items = make([]collections.SlideshowItem, 501)
			for i := range s.Spec.Items {
				s.Spec.Items[i] = collections.SlideshowItem{Group: "g", Resource: "r", Name: "n"}
			}
		}, "spec.items"},
	}
	for _, tt := range tests {
		t.Run("rejects "+tt.name, func(t *testing.T) {
			s := validSlideshow()
			tt.mutate(s)
			err := validate(t, admission.Create, s)
			require.Error(t, err)
			require.ErrorContains(t, err, tt.err)
		})
	}
}

func TestSlideshowDefaultsMissingItemsToEmpty(t *testing.T) {
	s := validSlideshow()
	s.Spec.Items = nil

	attrs := admission.NewAttributesRecord(s, nil,
		collections.SlideshowResourceInfo.GroupVersionKind(), "default", "noc-wall",
		collections.SlideshowResourceInfo.GroupVersionResource(), "", admission.Create, nil, false, nil)
	require.NoError(t, (&APIBuilder{}).Mutate(context.Background(), attrs, nil))

	require.NotNil(t, s.Spec.Items)
	require.Empty(t, s.Spec.Items)
}
