import { css } from '@emotion/css';
import React from 'react';

import { DataSourceInstanceSettings, DataSourceJsonData, GrafanaTheme2 } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';

export interface DataSourceDisplayProps {
  dataSource: DataSourceInstanceSettings<DataSourceJsonData> | string | DataSourceRef | null | undefined;
}

export function DataSourceDisplay(props: DataSourceDisplayProps) {
  const { dataSource } = props;
  const styles = useStyles2(getStyles);

  if (!dataSource) {
    return <span>Unknown</span>;
  }

  if (typeof dataSource === 'string') {
    return <span>${dataSource} - not found</span>;
  }

  if ('name' in dataSource) {
    return (
      <>
        <img
          className={styles.pickerDSLogo}
          alt={`${dataSource.meta.name} logo`}
          src={dataSource.meta.info.logos.small}
        ></img>
        <span>{dataSource.name}</span>
      </>
    );
  }

  return <span>{dataSource.uid} - not found</span>;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    pickerDSLogo: css`
      height: 20px;
      width: 20px;
      margin-right: ${theme.spacing(1)};
    `,
  };
}
