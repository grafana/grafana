import { css } from '@emotion/css';
import { useId } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, useTheme2 } from '@grafana/ui';

/** The sparkle that marks an Assistant feature, in the gradient of the Assistant's Chat button in the top bar. */
export function AiSparkleIcon() {
  const theme = useTheme2();
  // useId returns colons, which a url(#…) paint reference does not reliably resolve.
  const gradientId = `ai-sparkle-gradient-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const styles = useStyles2(getStyles, gradientId);

  return (
    <span className={styles.icon}>
      <svg width="0" height="0" className={styles.definitions} aria-hidden focusable="false">
        <defs>
          {/* Icons draw on a 24-unit grid, so the gradient spans the whole icon. */}
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor={theme.visualization.getColorByName('orange')} />
            <stop offset="80%" stopColor={theme.visualization.getColorByName('dark-purple')} />
          </linearGradient>
        </defs>
      </svg>
      <Icon name="ai-sparkle" />
    </span>
  );
}

function getStyles(_theme: GrafanaTheme2, gradientId: string) {
  return {
    icon: css({
      display: 'inline-flex',
      '& svg path': {
        fill: `url(#${gradientId})`,
        stroke: `url(#${gradientId})`,
      },
    }),
    definitions: css({
      position: 'absolute',
    }),
  };
}
