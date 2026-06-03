package dashboardcomments

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

// fakeStore is an in-memory store suitable for unit-testing the service layer.
type fakeStore struct {
	threads  map[int64]*Thread
	messages map[int64]*Message
	nextID   int64
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		threads:  make(map[int64]*Thread),
		messages: make(map[int64]*Message),
		nextID:   0,
	}
}

func (f *fakeStore) nextid() int64 {
	f.nextID++
	return f.nextID
}

func (f *fakeStore) ListThreads(_ context.Context, orgID int64, dashboardUID string) ([]*Thread, error) {
	out := make([]*Thread, 0)
	for _, t := range f.threads {
		if t.OrgID == orgID && t.DashboardUID == dashboardUID {
			tc := *t
			tc.Messages = nil
			for _, m := range f.messages {
				if m.ThreadID == t.ID {
					tc.Messages = append(tc.Messages, *m)
				}
			}
			out = append(out, &tc)
		}
	}
	return out, nil
}

func (f *fakeStore) GetThread(_ context.Context, orgID, threadID int64) (*Thread, error) {
	t, ok := f.threads[threadID]
	if !ok || t.OrgID != orgID {
		return nil, ErrThreadNotFound
	}
	tc := *t
	tc.Messages = nil
	for _, m := range f.messages {
		if m.ThreadID == threadID {
			tc.Messages = append(tc.Messages, *m)
		}
	}
	return &tc, nil
}

func (f *fakeStore) InsertThread(_ context.Context, thread *Thread, firstMessage *Message) (*Thread, error) {
	thread.ID = f.nextid()
	f.threads[thread.ID] = thread
	firstMessage.ID = f.nextid()
	firstMessage.ThreadID = thread.ID
	f.messages[firstMessage.ID] = firstMessage
	thread.Messages = []Message{*firstMessage}
	return thread, nil
}

func (f *fakeStore) UpdateThread(_ context.Context, thread *Thread) error {
	if _, ok := f.threads[thread.ID]; !ok {
		return ErrThreadNotFound
	}
	f.threads[thread.ID] = thread
	return nil
}

func (f *fakeStore) DeleteThread(_ context.Context, orgID, threadID int64) error {
	t, ok := f.threads[threadID]
	if !ok || t.OrgID != orgID {
		return ErrThreadNotFound
	}
	delete(f.threads, threadID)
	for id, m := range f.messages {
		if m.ThreadID == threadID {
			delete(f.messages, id)
		}
	}
	return nil
}

func (f *fakeStore) InsertMessage(_ context.Context, msg *Message) (*Message, error) {
	msg.ID = f.nextid()
	f.messages[msg.ID] = msg
	return msg, nil
}

func (f *fakeStore) GetMessage(_ context.Context, id int64) (*Message, error) {
	m, ok := f.messages[id]
	if !ok {
		return nil, ErrMessageNotFound
	}
	return m, nil
}

func (f *fakeStore) DeleteMessage(_ context.Context, id int64) error {
	if _, ok := f.messages[id]; !ok {
		return ErrMessageNotFound
	}
	delete(f.messages, id)
	return nil
}

func newTestService() (*ServiceImpl, *fakeStore) {
	fs := newFakeStore()
	return &ServiceImpl{store: fs, logger: log.New("test")}, fs
}

func validCreateCmd() *CreateThreadCommand {
	return &CreateThreadCommand{
		OrgID:             1,
		DashboardUID:      "dash-1",
		CreatedByUserID:   42,
		AnchorPanelKey:    "panel-1",
		AnchorXNorm:       0.5,
		AnchorYNorm:       0.5,
		ContextPanelTitle: "Latency",
		ContextTimeFrom:   "now-6h",
		ContextTimeTo:     "now",
		InitialBody:       "first message",
	}
}

func TestCreateThread(t *testing.T) {
	t.Run("validation: missing fields", func(t *testing.T) {
		svc, _ := newTestService()
		cmd := validCreateCmd()
		cmd.OrgID = 0
		_, err := svc.CreateThread(context.Background(), cmd)
		if !errors.Is(err, ErrValidationFailed) {
			t.Fatalf("expected ErrValidationFailed, got %v", err)
		}
	})

	t.Run("validation: empty body", func(t *testing.T) {
		svc, _ := newTestService()
		cmd := validCreateCmd()
		cmd.InitialBody = ""
		_, err := svc.CreateThread(context.Background(), cmd)
		if !errors.Is(err, ErrEmptyBody) {
			t.Fatalf("expected ErrEmptyBody, got %v", err)
		}
	})

	t.Run("happy path creates thread with first message", func(t *testing.T) {
		svc, _ := newTestService()
		created, err := svc.CreateThread(context.Background(), validCreateCmd())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if created.ID == 0 {
			t.Fatal("expected thread id > 0")
		}
		if len(created.Messages) != 1 {
			t.Fatalf("expected 1 message, got %d", len(created.Messages))
		}
		if created.Messages[0].Body != "first message" {
			t.Errorf("unexpected body: %q", created.Messages[0].Body)
		}
		if created.Messages[0].AuthorUserID != 42 {
			t.Errorf("expected author 42, got %d", created.Messages[0].AuthorUserID)
		}
	})
}

func TestUpdateThreadPermissions(t *testing.T) {
	svc, _ := newTestService()
	created, err := svc.CreateThread(context.Background(), validCreateCmd())
	if err != nil {
		t.Fatalf("setup failed: %v", err)
	}

	t.Run("author can resolve", func(t *testing.T) {
		resolved := true
		_, err := svc.UpdateThread(context.Background(), &UpdateThreadCommand{
			OrgID:        1,
			ThreadID:     created.ID,
			ActingUserID: 42, // same as creator
			Resolved:     &resolved,
		})
		if err != nil {
			t.Fatalf("author should be able to resolve, got %v", err)
		}
	})

	t.Run("non-author forbidden without editor role", func(t *testing.T) {
		resolved := false
		_, err := svc.UpdateThread(context.Background(), &UpdateThreadCommand{
			OrgID:        1,
			ThreadID:     created.ID,
			ActingUserID: 99, // different user
			Resolved:     &resolved,
		})
		if !errors.Is(err, ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("non-author allowed with editor role", func(t *testing.T) {
		resolved := true
		_, err := svc.UpdateThread(context.Background(), &UpdateThreadCommand{
			OrgID:        1,
			ThreadID:     created.ID,
			ActingUserID: 99,
			IsDashEditor: true,
			Resolved:     &resolved,
		})
		if err != nil {
			t.Fatalf("editor should be able to resolve, got %v", err)
		}
	})

	t.Run("resolved sets resolvedBy and resolvedAt", func(t *testing.T) {
		resolved := true
		before := time.Now().UTC()
		updated, err := svc.UpdateThread(context.Background(), &UpdateThreadCommand{
			OrgID:        1,
			ThreadID:     created.ID,
			ActingUserID: 42,
			Resolved:     &resolved,
		})
		if err != nil {
			t.Fatalf("unexpected: %v", err)
		}
		if updated.ResolvedByUserID != 42 {
			t.Errorf("resolved by = %d, want 42", updated.ResolvedByUserID)
		}
		if updated.ResolvedAt.Before(before) {
			t.Errorf("resolvedAt %v is before call time %v", updated.ResolvedAt, before)
		}
	})
}

func TestDeleteThreadPermissions(t *testing.T) {
	svc, _ := newTestService()
	created, err := svc.CreateThread(context.Background(), validCreateCmd())
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	t.Run("non-author forbidden", func(t *testing.T) {
		err := svc.DeleteThread(context.Background(), &DeleteThreadCommand{
			OrgID:        1,
			ThreadID:     created.ID,
			ActingUserID: 99,
		})
		if !errors.Is(err, ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("author can delete", func(t *testing.T) {
		err := svc.DeleteThread(context.Background(), &DeleteThreadCommand{
			OrgID:        1,
			ThreadID:     created.ID,
			ActingUserID: 42,
		})
		if err != nil {
			t.Fatalf("author should delete, got %v", err)
		}
		// Confirm it's gone
		_, err = svc.ListThreads(context.Background(), &ListThreadsQuery{OrgID: 1, DashboardUID: "dash-1"})
		if err != nil {
			t.Fatalf("list after delete: %v", err)
		}
	})
}

func TestAddMessage(t *testing.T) {
	svc, _ := newTestService()
	created, err := svc.CreateThread(context.Background(), validCreateCmd())
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	t.Run("validation: empty body", func(t *testing.T) {
		_, err := svc.AddMessage(context.Background(), &AddMessageCommand{
			OrgID: 1, ThreadID: created.ID, AuthorUserID: 42, Body: "",
		})
		if !errors.Is(err, ErrEmptyBody) {
			t.Fatalf("expected ErrEmptyBody, got %v", err)
		}
	})

	t.Run("happy path appends message", func(t *testing.T) {
		msg, err := svc.AddMessage(context.Background(), &AddMessageCommand{
			OrgID: 1, ThreadID: created.ID, AuthorUserID: 99, Body: "reply",
		})
		if err != nil {
			t.Fatalf("unexpected: %v", err)
		}
		if msg.ID == 0 || msg.ThreadID != created.ID {
			t.Errorf("bad message: %+v", msg)
		}
	})

	t.Run("thread not found", func(t *testing.T) {
		_, err := svc.AddMessage(context.Background(), &AddMessageCommand{
			OrgID: 1, ThreadID: 99999, AuthorUserID: 42, Body: "hi",
		})
		if !errors.Is(err, ErrThreadNotFound) {
			t.Fatalf("expected ErrThreadNotFound, got %v", err)
		}
	})
}

func TestListThreads(t *testing.T) {
	svc, _ := newTestService()
	if _, err := svc.CreateThread(context.Background(), validCreateCmd()); err != nil {
		t.Fatalf("setup: %v", err)
	}

	threads, err := svc.ListThreads(context.Background(), &ListThreadsQuery{OrgID: 1, DashboardUID: "dash-1"})
	if err != nil {
		t.Fatalf("unexpected: %v", err)
	}
	if len(threads) != 1 {
		t.Fatalf("expected 1 thread, got %d", len(threads))
	}

	t.Run("validation", func(t *testing.T) {
		_, err := svc.ListThreads(context.Background(), &ListThreadsQuery{OrgID: 0, DashboardUID: "x"})
		if !errors.Is(err, ErrValidationFailed) {
			t.Fatalf("expected validation, got %v", err)
		}
	})
}
