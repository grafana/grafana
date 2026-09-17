import { css, keyframes } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  /** 0-100. Renders an indeterminate sliding animation instead when omitted. */
  percent?: number;
  /**
   * Which theme color to fill the bar with. Defaults to 'error' to match the red "Deleting"
   * badge used in the browse tree; pass 'info' when pairing this with an info-severity Alert
   * (e.g. FolderCascadeStatusBanner's working state) so the bar doesn't read as an error there.
   */
  color?: 'error' | 'info';
}

/**
 * A small determinate progress bar for cascade delete's "remaining direct children" count (see
 * useCascadeDeleteProgress). @grafana/ui's LoadingBar is indeterminate-only, and this needs to
 * visibly fill up as the count drops rather than just slide back and forth forever, so the tree
 * badge and the folder-page banner both read as an operation that's actually progressing instead
 * of one that might be stuck.
 */
export function CascadeDeleteProgressBar({ percent, color = 'error' }: Props) {
  const styles = useStyles2(getStyles, color);

  if (percent === undefined) {
    return (
      <div className={styles.track}>
        <div className={styles.indeterminateFill} />
      </div>
    );
  }

  return (
    <div className={styles.track} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className={styles.fill} style={{ width: `${percent}%` }} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, color: 'error' | 'info') => {
  const slide = keyframes({
    '0%': { left: '-40%' },
    '100%': { left: '100%' },
  });
  const fillColor = theme.colors[color].main;

  return {
    track: css({
      position: 'relative',
      width: '100%',
      height: 4,
      borderRadius: theme.shape.radius.pill,
      background: theme.colors.background.secondary,
      overflow: 'hidden',
    }),
    fill: css({
      height: '100%',
      borderRadius: theme.shape.radius.pill,
      background: fillColor,
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'width 400ms ease-out',
      },
    }),
    indeterminateFill: css({
      position: 'absolute',
      top: 0,
      width: '40%',
      height: '100%',
      borderRadius: theme.shape.radius.pill,
      background: fillColor,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${slide} 1.2s ease-in-out infinite`,
      },
      [theme.transitions.handleMotion('reduce')]: {
        animation: `${slide} 4s ease-in-out infinite`,
      },
    }),
  };
};
