import { css, cx, keyframes } from '@emotion/css';
import { useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';

import { startIntercomSurvey } from '../../tracking';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

export function ExperimentalFeedbackButton() {
  const { showVersionBanner } = useQueryEditorUIContext();
  const { onSwitchToClassic } = useActionsContext();
  const styles = useStyles2(getStyles);

  // Track whether the banner was visible when this component first mounted.
  // If it was, the user dismissed it - animate the button in.
  // If it wasn't (already dismissed on load), skip the animation.
  const bannerWasInitiallyVisible = useRef(showVersionBanner);
  const shouldAnimate = bannerWasInitiallyVisible.current && !showVersionBanner;

  if (showVersionBanner || !onSwitchToClassic) {
    return null;
  }

  const menu = (
    <Menu>
      <Menu.Item
        label={t('query-editor-next.experimental-button.give-feedback', 'Give feedback')}
        icon="comment-alt-message"
        onClick={() => startIntercomSurvey()}
      />
      <Menu.Item
        label={t('query-editor-next.experimental-button.back-to-classic', 'Go back to classic editor')}
        icon="arrow-left"
        onClick={() => {
          startIntercomSurvey();
          onSwitchToClassic?.();
        }}
      />
    </Menu>
  );

  return (
    <div className={cx(styles.wrapper, shouldAnimate && styles.animated)}>
      <Dropdown overlay={menu} placement="bottom-end">
        <Button
          size="sm"
          fill="text"
          icon="flask"
          variant="secondary"
          className={styles.button}
          tooltip={t('query-editor-next.experimental-button.tooltip', 'Experimental feature options')}
          aria-label={t('query-editor-next.experimental-button.aria-label', 'Experimental feature options')}
        />
      </Dropdown>
    </div>
  );
}

const slideInAndPulse = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateX(24px) scale(0.6)',
  },
  '60%': {
    opacity: 1,
    transform: 'translateX(0) scale(1.2)',
  },
  '80%': {
    transform: 'translateX(0) scale(0.9)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateX(0) scale(1)',
  },
});

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
  }),
  animated: css({
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${slideInAndPulse} 0.6s ${theme.transitions.easing.easeOut} 100ms both`,
    },
  }),
  button: css({
    color: theme.colors.warning.main,
    '&:hover': {
      color: theme.colors.warning.text,
    },
  }),
});
