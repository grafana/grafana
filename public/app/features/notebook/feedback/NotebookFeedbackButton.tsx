import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Field, Modal, Stack, Text, TextArea, ToolbarButton, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { NotebookAnalytics } from '../analytics/main';
import {
  NOTEBOOK_FEEDBACK_RATING,
  NOTEBOOK_FEEDBACK_REASON,
  type NotebookFeedbackSource,
  type NotebookFeedbackRating,
  type NotebookFeedbackReason,
} from '../analytics/types';

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '520px',
    maxWidth: '90vw',
    [theme.breakpoints.down('sm')]: { paddingTop: theme.spacing(1) },
  }),
  modalContent: css({
    [theme.breakpoints.down('sm')]: { paddingTop: theme.spacing(2) },
  }),
});

export function NotebookFeedbackButton({
  labeled = false,
  source,
}: {
  labeled?: boolean;
  source: NotebookFeedbackSource;
}) {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<NotebookFeedbackRating>();
  const [selectedReasons, setSelectedReasons] = useState<NotebookFeedbackReason[]>([]);
  const [comment, setComment] = useState('');
  const negativeFeedbackNeedsDetails =
    rating === NOTEBOOK_FEEDBACK_RATING.COULD_BE_BETTER && selectedReasons.length === 0 && !comment.trim();
  const reasons: Array<{ value: NotebookFeedbackReason; label: string }> = [
    {
      value: NOTEBOOK_FEEDBACK_REASON.GETTING_STARTED,
      label: t('notebooks.feedback.reason.getting-started', 'Getting started'),
    },
    { value: NOTEBOOK_FEEDBACK_REASON.EDITING, label: t('notebooks.feedback.reason.editing', 'Editing') },
    {
      value: NOTEBOOK_FEEDBACK_REASON.ADDING_CONTENT,
      label: t('notebooks.feedback.reason.adding-content', 'Adding content'),
    },
    {
      value: NOTEBOOK_FEEDBACK_REASON.VISUALIZATIONS,
      label: t('notebooks.feedback.reason.visualizations', 'Visualizations'),
    },
    { value: NOTEBOOK_FEEDBACK_REASON.SHARING, label: t('notebooks.feedback.reason.sharing', 'Sharing') },
  ];
  const negativeReasons: Array<{ value: NotebookFeedbackReason; label: string }> = [
    ...reasons,
    {
      value: NOTEBOOK_FEEDBACK_REASON.SOMETHING_BROKEN,
      label: t('notebooks.feedback.reason.something-broken', 'Something is broken'),
    },
    {
      value: NOTEBOOK_FEEDBACK_REASON.MISSING_FEATURE,
      label: t('notebooks.feedback.reason.missing-feature', 'Missing feature'),
    },
  ];

  const close = () => {
    setIsOpen(false);
    setRating(undefined);
    setSelectedReasons([]);
    setComment('');
  };

  const submit = () => {
    if (rating === undefined || negativeFeedbackNeedsDetails) {
      return;
    }

    NotebookAnalytics.feedbackSubmitted(rating, selectedReasons, comment, source);
    notifyApp.success(t('notebooks.feedback.sent', 'Thanks for your feedback'));
    close();
  };

  if (!(config.rudderstackWriteKey && config.rudderstackDataPlaneUrl)) {
    return null;
  }

  return (
    <>
      {labeled ? (
        <Button
          variant="secondary"
          icon="comment-alt-message"
          data-testid={selectors.components.NotebookFeedback.button}
          onClick={() => setIsOpen(true)}
        >
          <Trans i18nKey="notebooks.feedback.give-feedback">Give feedback</Trans>
        </Button>
      ) : (
        <ToolbarButton
          variant="canvas"
          icon="comment-alt-message"
          data-testid={selectors.components.NotebookFeedback.button}
          tooltip={t('notebooks.feedback.give-feedback', 'Give feedback')}
          onClick={() => setIsOpen(true)}
        />
      )}
      {isOpen && (
        <Modal
          isOpen
          className={styles.modal}
          contentClassName={styles.modalContent}
          title={t('notebooks.feedback.title', 'Tell us about your experience with notebooks')}
          onDismiss={close}
        >
          <Stack direction="column" gap={2}>
            <Stack gap={1}>
              <Button
                variant={rating === NOTEBOOK_FEEDBACK_RATING.GOOD ? 'primary' : 'secondary'}
                icon="thumbs-up"
                aria-pressed={rating === NOTEBOOK_FEEDBACK_RATING.GOOD}
                onClick={() => {
                  setRating(NOTEBOOK_FEEDBACK_RATING.GOOD);
                  setSelectedReasons([]);
                }}
              >
                <Trans i18nKey="notebooks.feedback.positive">Good</Trans>
              </Button>
              <Button
                variant={rating === NOTEBOOK_FEEDBACK_RATING.COULD_BE_BETTER ? 'primary' : 'secondary'}
                icon="thumbs-down"
                aria-pressed={rating === NOTEBOOK_FEEDBACK_RATING.COULD_BE_BETTER}
                onClick={() => {
                  setRating(NOTEBOOK_FEEDBACK_RATING.COULD_BE_BETTER);
                  setSelectedReasons([]);
                }}
              >
                <Trans i18nKey="notebooks.feedback.negative">Could be better</Trans>
              </Button>
            </Stack>
            {rating !== undefined && (
              <>
                <Text variant="bodySmall">
                  {rating === NOTEBOOK_FEEDBACK_RATING.GOOD ? (
                    <Trans i18nKey="notebooks.feedback.positive-label">What do you like?</Trans>
                  ) : (
                    <Trans i18nKey="notebooks.feedback.reason-label">What could be better?</Trans>
                  )}
                </Text>
                <Stack gap={1} wrap="wrap">
                  {(rating === NOTEBOOK_FEEDBACK_RATING.GOOD ? reasons : negativeReasons).map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={selectedReasons.includes(value) ? 'primary' : 'secondary'}
                      size="sm"
                      aria-pressed={selectedReasons.includes(value)}
                      onClick={() =>
                        setSelectedReasons((current) =>
                          current.includes(value) ? current.filter((reason) => reason !== value) : [...current, value]
                        )
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </Stack>
                <Field
                  noMargin
                  label={t('notebooks.feedback.comment-label', 'Tell us more (optional)')}
                  htmlFor="notebook-feedback-comment"
                >
                  <TextArea
                    id="notebook-feedback-comment"
                    value={comment}
                    onChange={(event) => setComment(event.currentTarget.value)}
                    rows={3}
                    maxLength={2000}
                  />
                </Field>
              </>
            )}
            <Modal.ButtonRow>
              <Button variant="secondary" onClick={close}>
                <Trans i18nKey="notebooks.feedback.cancel">Cancel</Trans>
              </Button>
              <Button
                disabled={rating === undefined || negativeFeedbackNeedsDetails}
                tooltip={
                  negativeFeedbackNeedsDetails
                    ? t('notebooks.feedback.negative-help', 'Select a topic or add a comment.')
                    : undefined
                }
                onClick={submit}
              >
                <Trans i18nKey="notebooks.feedback.send">Send feedback</Trans>
              </Button>
            </Modal.ButtonRow>
          </Stack>
        </Modal>
      )}
    </>
  );
}
