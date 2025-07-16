import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, Field, Icon, Stack, Text, TextArea, useStyles2 } from '@grafana/ui';

export interface AIFeedbackComponentProps {
  onFeedback: (helpful: boolean, comment?: string) => void;
  showComment?: boolean;
  feedbackGiven?: boolean;
}

export const AIFeedbackComponent = ({
  onFeedback,
  showComment = false,
  feedbackGiven = false,
}: AIFeedbackComponentProps) => {
  const styles = useStyles2(getStyles);
  const [showCommentField, setShowCommentField] = useState(showComment);
  const [comment, setComment] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<boolean | null>(null);

  const handleFeedback = useCallback(
    (helpful: boolean) => {
      setSelectedFeedback(helpful);

      if (showComment) {
        setShowCommentField(true);
        return;
      }

      onFeedback(helpful, comment.trim() || undefined);
    },
    [onFeedback, comment, showComment]
  );

  const handleSubmitWithComment = useCallback(() => {
    if (selectedFeedback !== null) {
      onFeedback(selectedFeedback, comment.trim() || undefined);
      setShowCommentField(false);
    }
  }, [selectedFeedback, comment, onFeedback]);

  const handleSkipComment = useCallback(() => {
    if (selectedFeedback !== null) {
      onFeedback(selectedFeedback, undefined);
      setShowCommentField(false);
    }
  }, [selectedFeedback, onFeedback]);

  if (feedbackGiven) {
    return (
      <Stack direction="row" alignItems="center" gap={1} width={"100%"}>
        <Icon name="check" color="success" />
        <Text variant="bodySmall" color="success">
          <Trans i18nKey="alerting.ai-feedback.thank-you">Thank you for your feedback!</Trans>
        </Text>
      </Stack>
    );
  }

  if (showCommentField && selectedFeedback !== null) {
    return (
      <Box width={"100%"} padding={2} borderStyle="solid" borderColor={"weak"} >
        <Stack direction="column" gap={2} width={"100%"}>
          <Text variant="body">
            <Trans i18nKey="alerting.ai-feedback.comment-prompt">
              Would you like to tell us more about your experience?
            </Trans>
          </Text>
          <Field
            label={t('alerting.ai-feedback.comment-label', 'Additional feedback (optional)')}
            description={t(
              'alerting.ai-feedback.comment-description',
              'Help us improve by sharing what worked well or what could be better'
            )}
            noMargin
          >
            <TextArea
              value={comment}
              onChange={(e) => setComment(e.currentTarget.value)}
              placeholder={t('alerting.ai-feedback.comment-placeholder', 'Share your thoughts on the AI response...')}
              rows={3}
            />
          </Field>
          <Stack direction="row" gap={2} justifyContent="flex-end">
            <Button variant="secondary" size="sm" onClick={handleSkipComment}>
              <Trans i18nKey="alerting.ai-feedback.skip">Skip</Trans>
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmitWithComment}>
              <Trans i18nKey="alerting.ai-feedback.submit">Submit Feedback</Trans>
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Box width={"100%"} padding={2} borderStyle="solid" borderColor={"weak"} >
      <Stack direction="column" gap={2} width={"100%"}>
        <Text variant="body">
          <Trans i18nKey="alerting.ai-feedback.question">Was this AI response helpful?</Trans>
        </Text>
        <Stack direction="row" gap={2} alignItems="center">
          <Button
            variant="secondary"
            size="sm"
            icon="thumbs-up"
            onClick={() => handleFeedback(true)}
            className={styles.feedbackButton}
          >
            <Trans i18nKey="alerting.ai-feedback.helpful">Yes, helpful</Trans>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleFeedback(false)}
            className={styles.feedbackButton}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <Icon name="thumbs-up" className={styles.thumbsDown} />
              <Trans i18nKey="alerting.ai-feedback.not-helpful">No, not helpful</Trans>
            </Stack>
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({

  feedbackButton: css({
    minWidth: '120px',
  }),
  thumbsDown: css({
    transform: 'scale(-1, -1)',
  }),
}); 
