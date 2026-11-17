import { css, cx, keyframes } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

const SIZE = 14;

interface Props {
  itemName?: string;
}

export function StPodPendingDots({ itemName }: Props) {
  const styles = useStyles2(getStyles);

  const label = itemName
    ? t('app-chrome.st-loading.pending-dots-aria-label-named', 'Preparing {{itemName}}', {
        itemName,
        interpolation: { escapeValue: false },
      })
    : t('app-chrome.st-loading.pending-dots-aria-label', 'Preparing page');

  return (
    <svg
      className={cx('st-pod-dots', styles.dots)}
      width={SIZE}
      height={SIZE}
      viewBox="0 0 14 14"
      fill="none"
      role="img"
      aria-label={label}
      focusable="false"
    >
      <circle className={styles.dot} cx={2.5} cy={7} r={1.5} />
      <circle className={styles.dot} cx={7} cy={7} r={1.5} />
      <circle className={styles.dot} cx={11.5} cy={7} r={1.5} />
    </svg>
  );
}

const pulse = keyframes({
  '0%, 60%, 100%': { opacity: 0.3 },
  '30%': { opacity: 1 },
});

const getStyles = (theme: GrafanaTheme2) => ({
  dots: css({
    flexShrink: 0,
    opacity: 0.35,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'opacity 0.15s ease',
    },
  }),
  dot: css({
    fill: 'currentColor',
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${pulse} 1.2s ease-in-out infinite`,
      '&:nth-child(2)': { animationDelay: '0.2s' },
      '&:nth-child(3)': { animationDelay: '0.4s' },
    },
  }),
});
