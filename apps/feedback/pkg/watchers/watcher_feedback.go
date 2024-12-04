package watchers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/google/uuid"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"go.opentelemetry.io/otel"
	"k8s.io/klog/v2"

	feedback "github.com/grafana/grafana/apps/feedback/pkg/apis/feedback/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
)

var _ operator.ResourceWatcher = &FeedbackWatcher{}

type FeedbackWatcher struct {
	feedbackStore *resource.TypedStore[*feedback.Feedback]
	cfg           *setting.Cfg
}

func NewFeedbackWatcher(cfg *setting.Cfg, feedbackStore *resource.TypedStore[*feedback.Feedback]) (*FeedbackWatcher, error) {
	return &FeedbackWatcher{
		feedbackStore: feedbackStore,
		cfg:           cfg,
	}, nil
}

// Add handles add events for feedback.Feedback resources.
func (s *FeedbackWatcher) Add(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-add")
	defer span.End()
	object, ok := rObj.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	// upload to github
	section := s.cfg.SectionWithEnvOverrides("feedback_button")
	if section.Key("upload_to_github").MustBool(false) && object.Spec.ScreenshotUrl == nil { // So we don't spam when there are errors... obviously should figure out something better
		token, owner, repo := section.Key("github_token").MustString(""), section.Key("github_owner").MustString(""), section.Key("github_repo").MustString("")
		imageUuid := uuid.NewString()
		url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s.png", owner, repo, imageUuid)
		d, err := json.Marshal(struct {
			Message string `json:"message"`
			Content string `json:"content"`
		}{
			Message: fmt.Sprintf("unique commit message for image %s.png", imageUuid),
			Content: base64.StdEncoding.EncodeToString(object.Spec.Screenshot),
		})
		if err != nil {
			return fmt.Errorf("marshalling payload: %w", err)
		}

		r, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(d))
		if err != nil {
			return fmt.Errorf("creating request: %w", err)
		}
		r.Header.Add("Accept", "application/vnd.github+json")
		r.Header.Add("X-GitHub-Api-Version", "2022-11-28")
		r.Header.Add("Authorization", fmt.Sprintf("Bearer %s", token))

		githubUrl := makeUploadRequest(r)
		object.Spec.ScreenshotUrl = &githubUrl

		if _, err := s.feedbackStore.Update(ctx, resource.Identifier{Namespace: rObj.GetNamespace(), Name: rObj.GetName()}, object); err != nil {
			return fmt.Errorf("updating screenshot url (name=%s, namespace=%s, kind=%s): %w",
				rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind, err)
		}
	}

	logging.FromContext(ctx).Debug("Added resource", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}

func makeUploadRequest(req *http.Request) (githubUrl string) {
	defer func() {
		// return explicit value so we know there was an error and don't spam
		if githubUrl == "" {
			githubUrl = "ERROR"
		}
	}()

	client := http.Client{}
	resp, err := client.Do(req)

	// We should never return errors for this since it can spam github
	defer func() {
		if err := resp.Body.Close(); err != nil {
			klog.ErrorS(err, "failed to close response body")
		}
	}()
	if err != nil {
		klog.ErrorS(err, "making request")
	}
	if resp.StatusCode >= 400 {
		klog.ErrorS(fmt.Errorf("received status code %d", resp.StatusCode), "error status code")
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		klog.ErrorS(err, "reading request")
	}

	responseObj := &struct {
		Content struct {
			Url string `json:"html_url"` // this field with ?raw=true attached lets us embed in the issue
		} `json:"content"`
	}{}
	if err := json.Unmarshal(body, responseObj); err != nil {
		klog.ErrorS(err, "unmarshaling response")
	}
	return responseObj.Content.Url
}

// Update handles update events for feedback.Feedback resources.
func (s *FeedbackWatcher) Update(ctx context.Context, rOld resource.Object, rNew resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-update")
	defer span.End()
	oldObject, ok := rOld.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rOld.GetStaticMetadata().Name, rOld.GetStaticMetadata().Namespace, rOld.GetStaticMetadata().Kind)
	}

	_, ok = rNew.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rNew.GetStaticMetadata().Name, rNew.GetStaticMetadata().Namespace, rNew.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Updated resource", "name", oldObject.GetStaticMetadata().Identifier().Name)
	return nil
}

// Delete handles delete events for feedback.Feedback resources.
func (s *FeedbackWatcher) Delete(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-delete")
	defer span.End()
	object, ok := rObj.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Deleted resource", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}

// Sync is not a standard resource.Watcher function, but is used when wrapping this watcher in an operator.OpinionatedWatcher.
// It handles resources which MAY have been updated during an outage period where the watcher was not able to consume events.
func (s *FeedbackWatcher) Sync(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-sync")
	defer span.End()
	object, ok := rObj.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Possible resource update", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}
