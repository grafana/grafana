import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { Alert, Button, Modal, Stack, Text, TextArea } from '@grafana/ui';

const ASSISTANT_FEEDBACK_URL = '/api/plugins/grafana-assistant-app/resources/api/v1/feedback';

export interface QueryCoauthoringFeedbackState {
  outcome: 'proposal' | 'handoff';
  rating: -1 | 1;
}

interface Props {
  feedback: QueryCoauthoringFeedbackState;
  onClose: () => void;
}

export function QueryCoauthoringFeedback({ feedback, onClose }: Props) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);
    try {
      await getBackendSrv().post(ASSISTANT_FEEDBACK_URL, {
        targetKind: 'query-coauthoring',
        targetId: 'grafana.query.coauthor.v1',
        rating: feedback.rating,
        comment: comment.trim(),
        metadata: { outcome: feedback.outcome },
      });
      onClose();
    } catch {
      setError(t('query-editor-coauthoring.feedback-error', 'Feedback could not be sent. Try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      title={
        feedback.rating === 1
          ? t('query-editor-coauthoring.feedback-positive-title', 'What went well?')
          : t('query-editor-coauthoring.feedback-negative-title', 'What went wrong?')
      }
      onDismiss={onClose}
    >
      <Stack direction="column" gap={2}>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="query-editor-coauthoring.feedback-description">
            Your feedback helps improve the query experience in Grafana.
          </Trans>
        </Text>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="query-editor-coauthoring.feedback-recipient">
            Your feedback will be sent to the teams working on querying.
          </Trans>{' '}
          <Trans i18nKey="query-editor-coauthoring.feedback-privacy">
            Your rating, comment, and whether this was a proposal or handoff are sent. Your query, prompt, and Assistant
            response are not included.
          </Trans>
        </Text>
        <TextArea
          value={comment}
          rows={4}
          autoFocus
          aria-label={t('query-editor-coauthoring.feedback-label', 'Share feedback')}
          placeholder={
            feedback.rating === 1
              ? t(
                  'query-editor-coauthoring.feedback-positive-placeholder',
                  'What did you like? How could it have been even better?'
                )
              : t(
                  'query-editor-coauthoring.feedback-negative-placeholder',
                  "Describe what didn't go well and what you expected instead."
                )
          }
          onChange={(event) => setComment(event.currentTarget.value)}
        />
        {error && <Alert severity="error" title={error} />}
        <Modal.ButtonRow>
          <Button variant="secondary" disabled={isSubmitting} onClick={onClose}>
            <Trans i18nKey="query-editor-coauthoring.feedback-cancel">Cancel</Trans>
          </Button>
          <Button disabled={isSubmitting} onClick={() => void submit()}>
            {isSubmitting ? (
              <Trans i18nKey="query-editor-coauthoring.feedback-sending">Sending…</Trans>
            ) : (
              <Trans i18nKey="query-editor-coauthoring.feedback-send">Send</Trans>
            )}
          </Button>
        </Modal.ButtonRow>
      </Stack>
    </Modal>
  );
}
