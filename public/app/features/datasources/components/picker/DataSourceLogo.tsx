import { css } from '@emotion/css';
import React from 'react';

import { DataSourceInstanceSettings, DataSourceJsonData, GrafanaTheme2 } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';

export interface DataSourceLogoProps {
  dataSource: DataSourceInstanceSettings<DataSourceJsonData> | string | DataSourceRef | null | undefined;
}

export function DataSourceLogo(props: DataSourceLogoProps) {
  const { dataSource } = props;
  const styles = useStyles2(getStyles);

  if (!dataSource) {
    return null;
  }

  if (typeof dataSource === 'string') {
    return null;
  }

  if ('name' in dataSource) {
    return (
      <img
        className={styles.pickerDSLogo}
        alt={`${dataSource.meta.name} logo`}
        src={dataSource.meta.info.logos.small}
      ></img>
    );
  }

  return null;
}

export function DataSourceLogoPlaceHolder() {
  const styles = useStyles2(getStyles);
  return <div className={styles.pickerDSLogo}></div>;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    pickerDSLogo: css`
      height: 20px;
      width: 20px;
    `,
  };
}
