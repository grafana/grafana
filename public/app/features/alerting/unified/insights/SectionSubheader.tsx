import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src/themes';
import { useStyles2 } from '@grafana/ui';

import { DataSourceInformation } from '../home/Insights';

import { DataSourcesInfo } from './DataSourcesInfo';

export function SectionSubheader({
  children,
  datasources,
}: React.PropsWithChildren<{ datasources?: DataSourceInformation[] }>) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      {children}
      {datasources && <DataSourcesInfo datasources={datasources} />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  }),
});
