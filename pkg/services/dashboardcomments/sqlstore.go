package dashboardcomments

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
)

type sqlStore struct {
	db db.DB
}

func (s *sqlStore) ListThreads(ctx context.Context, orgID int64, dashboardUID string) ([]*Thread, error) {
	threads := make([]*Thread, 0)
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		if err := sess.Where("org_id = ? AND dashboard_uid = ?", orgID, dashboardUID).
			Asc("created_at").
			Find(&threads); err != nil {
			return err
		}
		if len(threads) == 0 {
			return nil
		}
		threadIDs := make([]int64, 0, len(threads))
		byID := make(map[int64]*Thread, len(threads))
		for _, t := range threads {
			threadIDs = append(threadIDs, t.ID)
			t.Messages = make([]Message, 0)
			byID[t.ID] = t
		}
		var messages []Message
		if err := sess.In("thread_id", threadIDs).Asc("created_at").Find(&messages); err != nil {
			return err
		}
		for _, m := range messages {
			if t, ok := byID[m.ThreadID]; ok {
				t.Messages = append(t.Messages, m)
			}
		}
		return nil
	})
	return threads, err
}

func (s *sqlStore) GetThread(ctx context.Context, orgID, threadID int64) (*Thread, error) {
	var thread Thread
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		found, err := sess.Where("id = ? AND org_id = ?", threadID, orgID).Get(&thread)
		if err != nil {
			return err
		}
		if !found {
			return ErrThreadNotFound
		}
		var messages []Message
		if err := sess.Where("thread_id = ?", threadID).Asc("created_at").Find(&messages); err != nil {
			return err
		}
		thread.Messages = messages
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &thread, nil
}

func (s *sqlStore) InsertThread(ctx context.Context, thread *Thread, firstMessage *Message) (*Thread, error) {
	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Insert(thread); err != nil {
			return err
		}
		firstMessage.ThreadID = thread.ID
		if _, err := sess.Insert(firstMessage); err != nil {
			return err
		}
		thread.Messages = []Message{*firstMessage}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return thread, nil
}

func (s *sqlStore) UpdateThread(ctx context.Context, thread *Thread) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.ID(thread.ID).Cols("resolved", "resolved_by_user_id", "resolved_at", "updated_at").Update(thread)
		return err
	})
}

func (s *sqlStore) DeleteThread(ctx context.Context, orgID, threadID int64) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Exec("DELETE FROM dashboard_comment_message WHERE thread_id = ?", threadID); err != nil {
			return err
		}
		res, err := sess.Exec("DELETE FROM dashboard_comment_thread WHERE id = ? AND org_id = ?", threadID, orgID)
		if err != nil {
			return err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrThreadNotFound
		}
		return nil
	})
}

func (s *sqlStore) InsertMessage(ctx context.Context, msg *Message) (*Message, error) {
	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Insert(msg); err != nil {
			return err
		}
		_, err := sess.Exec("UPDATE dashboard_comment_thread SET updated_at = ? WHERE id = ?", msg.CreatedAt, msg.ThreadID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return msg, nil
}

func (s *sqlStore) GetMessage(ctx context.Context, messageID int64) (*Message, error) {
	var msg Message
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		found, err := sess.ID(messageID).Get(&msg)
		if err != nil {
			return err
		}
		if !found {
			return ErrMessageNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

func (s *sqlStore) DeleteMessage(ctx context.Context, messageID int64) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		res, err := sess.Exec("DELETE FROM dashboard_comment_message WHERE id = ?", messageID)
		if err != nil {
			return err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrMessageNotFound
		}
		return nil
	})
}
