package state

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingModels "github.com/grafana/alerting/models"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/rendering"
)

func TestImageCaptureBackoffDuration(t *testing.T) {
	for _, tc := range []struct {
		count int
		want  time.Duration
	}{
		{-1, 0}, {0, 0}, {1, 30 * time.Second}, {2, time.Minute},
		{3, 2 * time.Minute}, {6, 16 * time.Minute}, {7, 30 * time.Minute},
		{1_000_000, 30 * time.Minute},
	} {
		t.Run(fmt.Sprint(tc.count), func(t *testing.T) {
			assert.Equal(t, tc.want, imageCaptureBackoffDuration(tc.count))
		})
	}
}

func TestImageAttempt(t *testing.T) {
	t.Run("timeout classification", func(t *testing.T) {
		for _, err := range []error{context.DeadlineExceeded, rendering.ErrServerTimeout, rendering.ErrTimeout} {
			for _, err := range []error{err, fmt.Errorf("capture: %w", err)} {
				attempt := newImageAttempt(nil, err).withPrevious(nil)
				assert.ErrorIs(t, attempt.Error, err)
				assert.Equal(t, 1, attempt.consecutiveTimeouts)
				assert.Equal(t, 30*time.Second, attempt.ExpiresAt.Sub(attempt.CreatedAt))
			}
		}
		assert.False(t, isRetryableError(nil))
		assert.False(t, isRetryableError(context.Canceled))
	})

	t.Run("shared results and previous attempts remain unchanged", func(t *testing.T) {
		shared := newImageAttempt(nil, context.DeadlineExceeded)
		first := shared.withPrevious(nil)
		snapshot := *first
		second := shared.withPrevious(first)
		assert.Equal(t, snapshot, *first)
		assert.Zero(t, shared.consecutiveTimeouts)
		assert.Equal(t, 2, second.consecutiveTimeouts)
		assert.Equal(t, time.Minute, second.ExpiresAt.Sub(second.CreatedAt))
		assert.Equal(t, 1, shared.withPrevious(nil).consecutiveTimeouts)
		for range 100 {
			second = shared.withPrevious(second)
		}
		assert.Equal(t, imageCaptureBackoffMax, second.ExpiresAt.Sub(second.CreatedAt))
	})

	t.Run("other outcomes reset backoff", func(t *testing.T) {
		previous := newImageAttempt(nil, context.DeadlineExceeded).withPrevious(nil)
		img := &models.Image{URL: "https://example.com/image.png", ExpiresAt: time.Now().Add(time.Hour)}
		success := newImageAttempt(img, nil).withPrevious(previous)
		assert.Equal(t, *img, success.Image)
		assert.Zero(t, success.consecutiveTimeouts)
		failure := newImageAttempt(nil, errors.New("failed")).withPrevious(previous)
		assert.Zero(t, failure.consecutiveTimeouts)
		assert.True(t, failure.HasExpired())
		assert.Nil(t, newImageAttempt(nil, nil).withPrevious(previous))
	})
}

func TestTransitionImageCapturePreservesImage(t *testing.T) {
	for _, captureErr := range []error{context.DeadlineExceeded, errors.New("capture failed"), nil} {
		t.Run(fmt.Sprint(captureErr), func(t *testing.T) {
			rule := &models.AlertRule{IntervalSeconds: 60}
			image := &models.Image{Token: "token", URL: "https://example.com/image.png", ExpiresAt: time.Now().Add(time.Hour)}
			s := &State{State: eval.Alerting, Image: newImageAttempt(image, nil)}
			previous := s.Copy()
			transition := s.transition(rule, eval.Result{State: eval.Normal, EvaluatedAt: time.Now()}, nil, log.NewNopLogger(), func(string) *ImageAttempt {
				return newImageAttempt(nil, captureErr)
			}, false)
			assert.Equal(t, image, s.Image.notificationImage())
			assert.Equal(t, newImageAttempt(image, nil), previous.Image)
			alert := StateToPostableAlert(transition, &url.URL{Scheme: "https", Host: "grafana.example.com"})
			assert.Equal(t, image.Token, alert.Annotations[alertingModels.ImageTokenAnnotation])
			assert.Equal(t, image.URL, alert.Annotations[alertingModels.ImageURLAnnotation])

			// A second failed refresh must retain the successful capture, not the failed attempt.
			s.Image = newImageAttempt(nil, context.DeadlineExceeded).withPrevious(s.Image)
			assert.Equal(t, image, s.Image.notificationImage())
			s.Image = newImageAttempt(nil, nil).withPrevious(s.Image)
			assert.Equal(t, newImageAttempt(image, nil), s.Image)
		})
	}
}

func TestTransitionNilCaptureResetsBackoff(t *testing.T) {
	rule := &models.AlertRule{IntervalSeconds: 60}
	s := &State{State: eval.Alerting, Image: newImageAttempt(nil, context.DeadlineExceeded).withPrevious(nil)}
	s.Image.ExpiresAt = time.Now().Add(-time.Second)
	previous := s.Copy()
	transition := func(capture takeImageFn) {
		s.transition(rule, eval.Result{State: eval.Alerting, EvaluatedAt: time.Now()}, nil, log.NewNopLogger(), capture, false)
	}
	transition(func(string) *ImageAttempt { return nil })
	require.Nil(t, s.Image)
	assert.Equal(t, 1, previous.Image.consecutiveTimeouts)
	transition(func(string) *ImageAttempt { return newImageAttempt(nil, context.DeadlineExceeded) })
	require.NotNil(t, s.Image)
	assert.Equal(t, 1, s.Image.consecutiveTimeouts)
	assert.Equal(t, imageCaptureBackoffBase, s.Image.ExpiresAt.Sub(s.Image.CreatedAt))
}

func TestTransitionImageCaptureBackoff(t *testing.T) {
	rule := &models.AlertRule{IntervalSeconds: 60, ExecErrState: models.ErrorErrState, NoDataState: models.NoData}
	s := &State{State: eval.Normal}
	attempts := 0
	captureErr := context.DeadlineExceeded
	capture := func(string) *ImageAttempt {
		attempts++
		if captureErr != nil {
			return newImageAttempt(nil, captureErr)
		}
		return newImageAttempt(&models.Image{URL: "https://example.com/image.png", ExpiresAt: time.Now().Add(time.Hour)}, nil)
	}
	transition := func(state eval.State) {
		// An old scheduled tick must not consume the cooldown of a slow capture.
		s.transition(rule, eval.Result{State: state, EvaluatedAt: time.Now().Add(-time.Hour)}, nil, log.NewNopLogger(), capture, false)
	}

	before := time.Now()
	transition(eval.Alerting)
	require.NotNil(t, s.Image)
	assert.False(t, s.Image.ExpiresAt.Before(before.Add(imageCaptureBackoffBase)))
	transition(eval.Alerting)
	assert.Equal(t, 1, attempts)

	s.Image.ExpiresAt = time.Now().Add(-time.Second)
	transition(eval.Alerting)
	assert.Equal(t, 2, attempts)
	assert.Equal(t, 2, s.Image.consecutiveTimeouts)

	transition(eval.Normal)
	assert.Equal(t, 3, attempts, "resolution bypasses cooldown")
	transition(eval.Alerting)
	assert.Equal(t, 4, attempts, "new firing transition bypasses cooldown")

	s.Image.ExpiresAt = time.Now().Add(-time.Second)
	captureErr = errors.New("other failure")
	transition(eval.Alerting)
	assert.Zero(t, s.Image.consecutiveTimeouts)
	transition(eval.Alerting)
	assert.Equal(t, 6, attempts, "other errors retry every evaluation")

	captureErr = nil
	transition(eval.Alerting)
	require.NoError(t, s.Image.Error)
	assert.Zero(t, s.Image.consecutiveTimeouts)
	transition(eval.Alerting)
	assert.Equal(t, 7, attempts, "valid image prevents retries")
}
