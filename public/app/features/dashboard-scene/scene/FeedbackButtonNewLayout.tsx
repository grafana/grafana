import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import feedbackImage from '../../../../img/icons/unicons/feedback.svg';

export function FeedbackButtonNewLayout() {
  const styles = useStyles2(getStyles);
  return (
    <a
      href="https://docs.google.com/forms/d/e/1FAIpQLSfDZJM_VlZgRHDx8UPtLWbd9bIBPRxoA28qynTHEYniyPXO6Q/viewform"
      target="_blank"
      rel="noreferrer"
      className={styles.button}
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      title="Give feedback on the new layout"
    >
      <img src={feedbackImage} alt="Feedback button" width="32" height="32" />
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    position: 'fixed',
    bottom: 16,
    right: 16,
    zIndex: 1001,
    background: theme.colors.gradients.brandHorizontal,
    borderRadius: theme.shape.radius.circle,
    padding: theme.spacing(1),
    '&': {
      filter: 'brightness(0.9)',
    },
    '&:hover, &:focus': {
      filter: 'brightness(1)',
    },
  }),
});
