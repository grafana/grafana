import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

export const Submit = () => {
  const styles = useStyles2(getStyles);

  return (
    <Button type="submit" className={styles.button}>
      Submit
    </Button>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    height: '100%',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  }),
});
