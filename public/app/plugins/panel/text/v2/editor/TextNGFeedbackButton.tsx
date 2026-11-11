import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
import { TextPanelFeedbackEvent } from 'app/types/events';

import { isTextNewFeaturesEnabled } from '../utils';

export const FEEDBACK_BUTTON_TEST_ID = 'TextNGEditor-feedback-button';

export function TextNGFeedbackButton() {
  const styles = useStyles2(getStyles);

  if (!isTextNewFeaturesEnabled()) {
    return null;
  }

  const label = t('textng.editor.feedback', 'Give feedback');

  return (
    <Button
      size="sm"
      fill="text"
      variant="secondary"
      icon="comment-alt-message"
      className={styles.button}
      tooltip={label}
      aria-label={label}
      data-testid={FEEDBACK_BUTTON_TEST_ID}
      // Picked up by grafana-setupguide-app, which answers with an in-house survey in Cloud.
      onClick={() => getAppEvents().publish(new TextPanelFeedbackEvent())}
    >
      {label}
    </Button>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Matches the experimental-feature button in the new query editor.
  button: css({
    color: theme.colors.warning.main,
    '&:hover': {
      color: theme.colors.warning.text,
    },
  }),
});
