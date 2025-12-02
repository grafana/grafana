import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, ConfirmModal, Icon, TextArea, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { useDispatch, useSelector } from 'app/types/store';

import { CommentData } from '../crdt/types';
import { addComment, removeComment } from '../state/crdtSlice';
import { selectComments } from '../state/selectors';

export function ExploreMapComment() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const comments = useSelector((state) => selectComments(state.exploreMapCRDT));
  const [editing, setEditing] = useState(false);
  const [commentValue, setCommentValue] = useState('');
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [editing]);

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length]);

  const handleAddCommentClick = useCallback(() => {
    setEditing(true);
    setIsCollapsed(false); // Expand when adding a comment
  }, []);

  const handleHeaderClick = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleHeaderKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleHeaderClick();
      }
    },
    [handleHeaderClick]
  );

  const handleSave = useCallback(() => {
    const trimmedText = commentValue.trim();
    
    if (trimmedText) {
      const commentData: CommentData = {
        text: trimmedText,
        username: contextSrv.user.name || contextSrv.user.login || 'Unknown',
        timestamp: Date.now(),
      };
      dispatch(addComment({ comment: commentData }));
      setCommentValue('');
    }
    setEditing(false);
  }, [dispatch, commentValue]);

  const handleCancel = useCallback(() => {
    setCommentValue('');
    setEditing(false);
  }, []);

  const handleCommentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
      // Allow Ctrl/Cmd+Enter to save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleCancel, handleSave]
  );

  const formatTimestamp = useCallback((timestamp: number) => {
    if (!timestamp) {return '';}
    const dt = dateTime(timestamp);
    const now = dateTime();
    const diff = now.diff(dt, 'minutes');
    
    if (diff < 1) {
      return t('explore-map.comment.just-now', 'Just now');
    } else if (diff < 60) {
      return t('explore-map.comment.minutes-ago', '{{minutes}}m ago', { minutes: Math.floor(diff) });
    } else if (diff < 1440) {
      return t('explore-map.comment.hours-ago', '{{hours}}h ago', { hours: Math.floor(diff / 60) });
    } else {
      return dt.format('MMM D, YYYY HH:mm');
    }
  }, []);

  const handleRemoveCommentClick = useCallback(
    (commentId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setCommentToDelete(commentId);
    },
    []
  );

  const handleConfirmDelete = useCallback(() => {
    if (commentToDelete) {
      dispatch(removeComment({ commentId: commentToDelete }));
      setCommentToDelete(null);
    }
  }, [dispatch, commentToDelete]);

  const handleCancelDelete = useCallback(() => {
    setCommentToDelete(null);
  }, []);

  const currentUsername = contextSrv.user.name || contextSrv.user.login || 'Unknown';

  if (editing) {
    return (
      <div className={styles.commentContainer}>
        <div className={styles.commentEditor}>
          <TextArea
            ref={textAreaRef}
            value={commentValue}
            onChange={(e) => setCommentValue(e.currentTarget.value)}
            onKeyDown={handleCommentKeyDown}
            placeholder={t('explore-map.comment.placeholder', 'Add a comment...')}
            rows={3}
            className={styles.commentTextArea}
          />
          <div className={styles.editorActions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
              icon="times"
            >
              {t('explore-map.comment.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              icon="check"
            >
              {t('explore-map.comment.save', 'Save')}
            </Button>
          </div>
          <div className={styles.commentHint}>
            {t('explore-map.comment.hint', 'Press Ctrl+Enter to save, Esc to cancel')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.commentContainer}>
      <div 
        className={cx(styles.commentsHeader, isCollapsed && styles.commentsHeaderCollapsed)}
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
        role="button"
        tabIndex={0}
      >
        <Icon name="comment-alt" className={styles.headerIcon} />
        <span className={styles.headerText}>
          {t('explore-map.comment.comments', 'Comments')} ({comments.length})
        </span>
        <Button
          variant="primary"
          size="sm"
          icon="plus"
          onClick={(e) => {
            e.stopPropagation();
            handleAddCommentClick();
          }}
          className={styles.addButton}
        >
          {t('explore-map.comment.add', 'Add')}
        </Button>
      </div>
      {!isCollapsed && (
        <div className={styles.commentsList}>
        {comments.length === 0 ? (
          <div className={styles.emptyState}>
            <Icon name="comment-alt" className={styles.emptyIcon} />
            <span className={styles.emptyText}>
              {t('explore-map.comment.no-comments', 'No comments yet. Be the first to comment!')}
            </span>
          </div>
        ) : (
          comments.map(({ id, data }) => (
            <div key={id} className={styles.commentItem}>
              <div className={styles.commentContent}>
                <span className={styles.commentText}>{data.text}</span>
                <div className={styles.commentMeta}>
                  <span className={styles.commentUsername}>{data.username}</span>
                  {data.timestamp && (
                    <span className={styles.commentTimestamp}>
                      {formatTimestamp(data.timestamp)}
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.commentActions}>
                {data.username === currentUsername && (
                  <Button
                    variant="secondary"
                    size="sm"
                    fill="text"
                    icon="trash-alt"
                    onClick={(e) => handleRemoveCommentClick(id, e)}
                    className={styles.deleteButton}
                    tooltip={t('explore-map.comment.delete', 'Delete comment')}
                  />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>
      )}

      <ConfirmModal
        isOpen={commentToDelete !== null}
        title={t('explore-map.comment.delete-title', 'Delete comment')}
        body={t('explore-map.comment.delete-body', 'Are you sure you want to delete this comment? This action cannot be undone.')}
        confirmText={t('explore-map.comment.delete-confirm', 'Delete')}
        dismissText={t('explore-map.comment.delete-cancel', 'Cancel')}
        onConfirm={handleConfirmDelete}
        onDismiss={handleCancelDelete}
        icon="exclamation-triangle"
        confirmButtonVariant="destructive"
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    commentContainer: css({
      position: 'fixed',
      bottom: theme.spacing(3),
      right: theme.spacing(3),
      width: '300px',
      maxHeight: '500px',
      zIndex: 1001,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
    }),
    commentsHeader: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'background-color 0.2s',
      },
      '&:hover': {
        backgroundColor: theme.colors.background.primary,
      },
    }),
    commentsHeaderCollapsed: css({
      borderBottom: 'none',
    }),
    headerIcon: css({
      color: theme.colors.text.secondary,
    }),
    headerText: css({
      flex: 1,
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    }),
    addButton: css({
      flexShrink: 0,
    }),
    commentsList: css({
      flex: 1,
      overflowY: 'auto',
      maxHeight: '400px',
      padding: theme.spacing(1),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    emptyState: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(3),
      textAlign: 'center',
      color: theme.colors.text.secondary,
    }),
    emptyIcon: css({
      fontSize: theme.spacing(4),
      marginBottom: theme.spacing(1),
      opacity: 0.5,
    }),
    emptyText: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontStyle: 'italic',
    }),
    commentItem: css({
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(1),
      padding: theme.spacing(1.5),
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'background-color 0.2s',
      },
      '&:hover': {
        backgroundColor: theme.colors.background.canvas,
      },
    }),
    commentContent: css({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    commentText: css({
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.text.primary,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      lineHeight: theme.typography.body.lineHeight,
    }),
    commentMeta: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      fontSize: theme.typography.bodySmall.fontSize,
      marginTop: theme.spacing(0.5),
    }),
    commentUsername: css({
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    commentTimestamp: css({
      color: theme.colors.text.disabled,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    commentActions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      flexShrink: 0,
    }),
    deleteButton: css({
      opacity: 0.6,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 0.2s',
      },
      '&:hover': {
        opacity: 1,
        color: theme.colors.error.text,
      },
    }),
    commentEditor: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(1.5),
    }),
    commentTextArea: css({
      width: '100%',
      resize: 'vertical',
      minHeight: '60px',
      marginBottom: theme.spacing(1),
    }),
    editorActions: css({
      display: 'flex',
      justifyContent: 'flex-end',
      gap: theme.spacing(1),
      marginTop: theme.spacing(1),
    }),
    commentHint: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
      marginTop: theme.spacing(0.5),
      textAlign: 'right',
    }),
  };
};
