import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src/themes';
import { useStyles2 } from '@grafana/ui';

export function SectionFooter({ children }: React.PropsWithChildren<{}>) {
  const styles = useStyles2(getStyles);

  return <div className={styles.sectionFooter}>{children && <div>{children}</div>}</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  sectionFooter: css({
    marginBottom: theme.spacing(2),
  }),
});
