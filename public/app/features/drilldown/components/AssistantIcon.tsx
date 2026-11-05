import { css } from '@emotion/css';
import { useId } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, type IconSize, useStyles2, useTheme2 } from '@grafana/ui';

interface Props {
  size?: IconSize;
}

// Grafana Assistant's sparkle with the orange-to-purple gradient from the top bar "Chat" button,
// so the Assistant looks the same wherever it appears on the page.
export function AssistantIcon({ size = 'md' }: Props) {
  const theme = useTheme2();
  const gradientId = `drilldown-assistant-gradient-${useId().replace(/:/g, '')}`;
  const styles = useStyles2(getStyles, gradientId);

  return (
    <span className={styles.icon}>
      <svg width="0" height="0" className={styles.defs} aria-hidden focusable="false">
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor={theme.visualization.getColorByName('orange')} />
            <stop offset="80%" stopColor={theme.visualization.getColorByName('dark-purple')} />
          </linearGradient>
        </defs>
      </svg>
      <Icon name="ai-sparkle" size={size} />
    </span>
  );
}

const getStyles = (_theme: GrafanaTheme2, gradientId: string) => ({
  icon: css({
    display: 'inline-flex',
    '& svg path': {
      fill: `url(#${gradientId})`,
      stroke: `url(#${gradientId})`,
    },
  }),
  defs: css({
    position: 'absolute',
  }),
});
