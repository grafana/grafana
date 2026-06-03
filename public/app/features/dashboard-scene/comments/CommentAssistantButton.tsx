import { useCallback } from 'react';

import { useAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { IconButton } from '@grafana/ui';

import { openCommentInAssistant, type CommentAssistantPinContext } from './commentAssistant';
import { type CommentThread } from './types';

interface Props {
  pin: CommentAssistantPinContext;
  thread?: CommentThread;
  origin: string;
  tooltip?: string;
  className?: string;
}

export function CommentAssistantButton({ pin, thread, origin, tooltip, className }: Props) {
  const { isAvailable, openAssistant } = useAssistant();

  const handleClick = useCallback(() => {
    if (!openAssistant) {
      return;
    }

    reportInteraction('dashboards_comment_assistant_opened', {
      dashboard_uid: pin.dashboardUid,
      panel_key: pin.panelKey,
      has_thread: Boolean(thread),
      thread_id: thread?.id,
      origin,
    });

    openCommentInAssistant(openAssistant, pin, { origin, thread });
  }, [openAssistant, origin, pin, thread]);

  if (!isAvailable || !openAssistant || !config.bootData.user.isSignedIn) {
    return null;
  }

  return (
    <IconButton
      name="ai-sparkle"
      size="md"
      className={className}
      onClick={handleClick}
      tooltip={
        tooltip ??
        (thread
          ? t('dashboard-scene.comments-assistant.thread-tooltip', 'Discuss in Assistant')
          : t('dashboard-scene.comments-assistant.compose-tooltip', 'Investigate in Assistant'))
      }
      data-testid="comment-assistant-button"
    />
  );
}
