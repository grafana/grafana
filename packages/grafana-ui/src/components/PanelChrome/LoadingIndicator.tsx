import { css, cx, keyframes } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

/**
 * @internal
 */
export type LoadingIndicatorProps = {
  loading: boolean;
  onCancel: () => void;
};

/**
 * @internal
 */
export const LoadingIndicator = ({ onCancel, loading }: LoadingIndicatorProps) => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const styles = useStyles2(getStyles);

  if (!loading) {
    return null;
  }

  return (
    <Tooltip content={t('grafana-ui.panel-chrome.tooltip-cancel-loading', 'Cancel query')}>
      <Icon
        className={cx(styles.spin, { [styles.clickable]: !!onCancel })}
        name={prefersReducedMotion ? 'hourglass' : 'sync'}
        size="sm"
        onClick={onCancel}
        data-testid={selectors.components.LoadingIndicator.icon}
      />
    </Tooltip>
  );
};

const spin = keyframes({
  '0%': {
    transform: 'rotate(0deg) scaleX(-1)', // scaleX flips the `sync` icon so arrows point the correct way
  },
  '100%': {
    transform: 'rotate(359deg) scaleX(-1)',
  },
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    clickable: css({
      cursor: 'pointer',
    }),
    spin: css({
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${spin} 3s linear infinite`,
      },
    }),
  };
};
