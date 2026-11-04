package collections

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
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

	t.Run("accepts intervals up to 24 hours", func(t *testing.T) {
		for _, interval := range []string{"10s", "30s", "5m", "1h", "24h", "1d", "1440m"} {
			s := validSlideshow()
			s.Spec.Interval = interval
			s.Spec.Items[0].Interval = ptr(interval)
			require.NoError(t, validate(t, admission.Create, s), interval)
		}
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
		{"compound interval the player cannot read", func(s *collections.Slideshow) { s.Spec.Interval = "1h30m" }, "spec.interval"},
		{"fractional item interval the player cannot read", func(s *collections.Slideshow) { s.Spec.Items[0].Interval = ptr("1.5m") }, "spec.items[0].interval"},
		{"interval over 24 hours", func(s *collections.Slideshow) { s.Spec.Interval = "25h" }, "spec.interval"},
		{"interval of days over the cap", func(s *collections.Slideshow) { s.Spec.Interval = "2d" }, "spec.interval"},
		{"interval of weeks", func(s *collections.Slideshow) { s.Spec.Interval = "4w" }, "spec.interval"},
		{"item interval of a month", func(s *collections.Slideshow) { s.Spec.Items[0].Interval = ptr("1M") }, "spec.items[0].interval"},
		{"item interval of a year", func(s *collections.Slideshow) { s.Spec.Items[0].Interval = ptr("1y") }, "spec.items[0].interval"},
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

func TestSlideshowValidationStaysCheapForHugeInvalidInput(t *testing.T) {
	t.Run("rejects an enormous list at once with one error naming the field", func(t *testing.T) {
		s := validSlideshow()
		s.Spec.Items = make([]collections.SlideshowItem, 100000)

		start := time.Now()
		errs := validateSlideshowSpec(&s.Spec)
		elapsed := time.Since(start)

		require.Less(t, elapsed, time.Second)
		require.Len(t, errs, 1)
		require.Equal(t, "spec.items", errs[0].Field)
		require.Equal(t, field.ErrorTypeTooMany, errs[0].Type)
	})

	t.Run("the rejection names the field", func(t *testing.T) {
		s := validSlideshow()
		s.Spec.Items = make([]collections.SlideshowItem, 100000)
		require.ErrorContains(t, validate(t, admission.Create, s), "spec.items")
	})

	t.Run("stops collecting errors after a fixed number", func(t *testing.T) {
		s := validSlideshow()
		s.Spec.Items = make([]collections.SlideshowItem, maxSlideshowItems)

		errs := validateSlideshowSpec(&s.Spec)

		require.GreaterOrEqual(t, len(errs), maxSlideshowErrors)
		require.LessOrEqual(t, len(errs), maxSlideshowErrors+3)
		require.Equal(t, "spec.items[0].group", errs[0].Field)
	})
}

func TestSlideshowTitleLength(t *testing.T) {
	for _, op := range []admission.Operation{admission.Create, admission.Update} {
		t.Run(string(op)+" accepts 255 characters, counting characters and not bytes", func(t *testing.T) {
			s := validSlideshow()
			s.Spec.Title = strings.Repeat("\u00e9", 255)
			require.NoError(t, validate(t, op, s))
		})

		t.Run(string(op)+" rejects 256 characters naming the title", func(t *testing.T) {
			s := validSlideshow()
			s.Spec.Title = strings.Repeat("a", 256)
			err := validate(t, op, s)
			require.Error(t, err)
			require.True(t, apierrors.IsInvalid(err))
			require.ErrorContains(t, err, "spec.title")
			require.ErrorContains(t, err, "may not be more than 255 characters")
		})
	}
}

func TestSlideshowInvalidValuesAreNotEchoedInFull(t *testing.T) {
	huge := strings.Repeat("x", 5_000_000)

	for name, mutate := range map[string]func(s *collections.Slideshow){
		"slideshow interval": func(s *collections.Slideshow) { s.Spec.Interval = huge },
		"item interval":      func(s *collections.Slideshow) { s.Spec.Items[0].Interval = ptr(huge) },
	} {
		t.Run(name, func(t *testing.T) {
			s := validSlideshow()
			mutate(s)
			err := validate(t, admission.Create, s)
			require.Error(t, err)
			require.Less(t, len(err.Error()), 1000)
			require.ErrorContains(t, err, "must be a whole number and a unit")
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
