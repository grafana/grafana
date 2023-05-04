import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { PageInfoItem } from 'app/core/components/Page/types';

import { DataSourceInfo } from '../types';

import { DataSourceDefaultSwitch } from './DataSourceDefaultSwitch';

export const useDataSourceInfo = (dataSourceInfo: DataSourceInfo): PageInfoItem[] => {
  const info: PageInfoItem[] = [];
  const alertingEnabled = dataSourceInfo.alertingSupported;
  const styles = useStyles2(getStyles);

  info.push({
    label: 'Type',
    value: <span className={styles.pageInfoValue}>{dataSourceInfo.dataSourcePluginName}</span>,
  });

  info.push({
    label: (
      <Tooltip content={'The default data source is preselected in new panels'}>
        <>
          Default
          <Icon className={styles.tooltip} name="exclamation-circle" />
        </>
      </Tooltip>
    ),
    value: (
      <DataSourceDefaultSwitch
        dataSource={dataSourceInfo.dataSource}
        isDefault={dataSourceInfo.isDefault}
        onUpdate={dataSourceInfo.onUpdate}
      ></DataSourceDefaultSwitch>
    ),
  });

  info.push({
    label: 'Alerting',
    value: (
      <div className={styles.pageInfoValue}>
        <Badge color={alertingEnabled ? 'green' : 'red'} text={alertingEnabled ? 'Supported' : 'Not supported'}></Badge>
      </div>
    ),
  });

  return info;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tooltip: css({
      marginLeft: '4px',
    }),
    pageInfoValue: css({
      flexGrow: 1,
      display: 'flex',
      alignItems: 'center',
    }),
  };
};
