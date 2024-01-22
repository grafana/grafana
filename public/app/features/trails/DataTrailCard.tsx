import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';
import { useStyles2, Stack, Tooltip, Button } from '@grafana/ui';

import { DataTrail } from './DataTrail';
import { LOGS_METRIC, VAR_DATASOURCE_EXPR, VAR_FILTERS } from './shared';

export interface Props {
  trail: DataTrail;
  onSelect: (trail: DataTrail) => void;
  onDelete?: () => void;
}

export function DataTrailCard({ trail, onSelect, onDelete }: Props) {
  const styles = useStyles2(getStyles);

  const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, trail)!;
  if (!(filtersVariable instanceof AdHocFiltersVariable)) {
    return null;
  }

  const filters = filtersVariable.state.set.state.filters;
  const dsValue = getDataSource(trail);

  return (
    <button className={styles.container} onClick={() => onSelect(trail)}>
      <div className={styles.wrapper}>
        <div className={styles.heading}>{getMetricName(trail.state.metric)}</div>
        {onDelete && (
          <Tooltip content={'Remove bookmark'}>
            <Button size="sm" icon="trash-alt" variant="destructive" fill="text" onClick={onDelete} />
          </Tooltip>
        )}
      </div>

      <Stack gap={1.5}>
        {dsValue && (
          <Stack direction="column" gap={0.5}>
            <div className={styles.label}>Datasource</div>
            <div className={styles.value}>{getDataSourceName(dsValue)}</div>
          </Stack>
        )}
        {filters.map((filter, index) => (
          <Stack key={index} direction="column" gap={0.5}>
            <div className={styles.label}>{filter.key}</div>
            <div className={styles.value}>{filter.value}</div>
          </Stack>
        ))}
      </Stack>
    </button>
  );
}

function getMetricName(metric?: string) {
  if (!metric) {
    return 'Select metric';
  }

  if (metric === LOGS_METRIC) {
    return 'Logs';
  }

  return metric;
}

function getDataSource(trail: DataTrail) {
  return sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
}

function getDataSourceName(dataSourceUid: string) {
  return getDataSourceSrv().getInstanceSettings(dataSourceUid)?.name || dataSourceUid;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(1),
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      width: '100%',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      boxShadow: 'none',
      background: 'transparent',
      textAlign: 'left',
      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      },
    }),
    label: css({
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    value: css({
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    heading: css({
      padding: theme.spacing(0),
      display: 'flex',
      fontWeight: theme.typography.fontWeightMedium,
      overflowX: 'hidden',
    }),
    body: css({
      padding: theme.spacing(0),
    }),
    wrapper: css({
      position: 'relative',
      display: 'flex',
      gap: theme.spacing.x1,
      justifyContent: 'space-between',
      width: '100%',
    }),
  };
}
