import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { HorizontalGroup, useStyles2 } from '@grafana/ui';

import { SupportedPlugin } from '../../../types/pluginBridges';

import { GRAFANA_APP_RECEIVERS_SOURCE_IMAGE } from './types';

export const GrafanaAppBadge = ({ grafanaAppType }: { grafanaAppType: SupportedPlugin }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <HorizontalGroup align="center" spacing="xs">
        <img src={GRAFANA_APP_RECEIVERS_SOURCE_IMAGE[grafanaAppType]} alt="" height="12px" />
        <span>{grafanaAppType}</span>
      </HorizontalGroup>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    text-align: left;
    height: 22px;
    display: inline-flex;
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid rgba(245, 95, 62, 1);
    color: rgba(245, 95, 62, 1);
    font-weight: ${theme.typography.fontWeightRegular};
  `,
});
