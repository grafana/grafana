import { css } from '@emotion/css';
import React from 'react';

import { DataSourceInstanceSettings, DataSourceJsonData, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface DataSourceLogoProps {
  dataSource: DataSourceInstanceSettings<DataSourceJsonData> | undefined;
}

export function DataSourceLogo(props: DataSourceLogoProps) {
  const { dataSource } = props;
  const styles = useStyles2(getStyles);

  if (!dataSource) {
    return DataSourceLogoPlaceHolder();
  }

  return (
    <img
      className={styles.pickerDSLogo}
      alt={`${dataSource.meta.name} logo`}
      src={dataSource.meta.info.logos.small}
    ></img>
  );
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
