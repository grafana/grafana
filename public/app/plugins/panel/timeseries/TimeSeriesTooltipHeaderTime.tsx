import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const TimeSeriesTooltipHeaderTime = ({ time, timeZone }: { time: string; timeZone: string }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <div>{time}</div>
      <div className={styles.timeZone}>{timeZone}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'row',
  }),
  timeZone: css({
    paddingLeft: theme.spacing(1),
    fontWeight: 'bold',
    color: theme.colors.text.secondary,
  }),
});
