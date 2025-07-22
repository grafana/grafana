import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface ProgressBarProps {
  progress?: number;
  topBottomSpacing?: number;
}
const ProgressBar = ({ progress, topBottomSpacing }: ProgressBarProps) => {
  const styles = useStyles2(getStyles, topBottomSpacing);

  if (progress === undefined) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.filler} style={{ width: `${progress}%` }}></div>
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
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'width 0.5s ease-in-out',
    },
  }),
});

export default ProgressBar;
