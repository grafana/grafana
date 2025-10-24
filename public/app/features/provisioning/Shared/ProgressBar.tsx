import { css } from '@emotion/css';
import { useRef, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

interface ProgressBarProps {
  progress?: number;
  topBottomSpacing?: number;
}
const ProgressBar = ({ progress, topBottomSpacing }: ProgressBarProps) => {
  const styles = useStyles2(getStyles, topBottomSpacing);
  const previousProgress = useRef(0);
  const shouldAnimate = progress !== undefined && progress > previousProgress.current;

  useEffect(() => {
    if (progress !== undefined) {
      previousProgress.current = progress;
    }
  }, [progress]);

  if (progress === undefined) {
    return null;
  }

  return (
    <div
      className={styles.container}
      aria-label={t('provisioning.shared.progress-bar.aria-label', 'Progress Bar')}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={shouldAnimate ? styles.fillerAnimated : styles.filler} style={{ width: `${progress}%` }} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, topBottomSpacing = 2) => ({
  container: css({
    height: '10px',
    width: '400px',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.pill,
    overflow: 'hidden',
    margin: theme.spacing(topBottomSpacing, 0),
  }),
  filler: css({
    height: '100%',
    background: theme.colors.success.text,
  }),
  fillerAnimated: css({
    height: '100%',
    background: theme.colors.success.text,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'width 0.5s ease-in-out',
    },
  }),
});

export default ProgressBar;
