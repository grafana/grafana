import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';
import { useStyles2, Stack, Card, Tag, IconButton } from '@grafana/ui';

import { DataTrail } from './DataTrail';
import { LOGS_METRIC, VAR_FILTERS } from './shared';
import { getDataSource, getDataSourceName } from './utils';

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
    <Card onClick={() => onSelect(trail)}>
      <Card.Heading className={styles.title}>{getMetricName(trail.state.metric)}</Card.Heading>
      <div className={styles.description}>
        <Stack gap={1.5}>
          {filters.map((f) => (
            <Tag key={f.key} name={`${f.key}: ${f.value}`} colorIndex={9} className={styles.tag} />
          ))}
        </Stack>
      </div>
      <Card.Actions className={styles.actions}>
        <Stack gap={1} justifyContent={'space-between'} grow={1}>
          <div className={styles.secondary}>Datasource: {getDataSourceName(dsValue)}</div>
          {trail.state.createdAt && (
            <i className={styles.secondary}>{new Date(trail.state.createdAt).toLocaleDateString()}</i>
          )}
        </Stack>
      </Card.Actions>
      {onDelete && (
        <Card.SecondaryActions>
          <IconButton
            key="delete"
            name="trash-alt"
            className={styles.secondary}
            tooltip="Remove bookmark"
            onClick={onDelete}
          />
        </Card.SecondaryActions>
      )}
    </Card>
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

function getStyles(theme: GrafanaTheme2) {
  return {
    title: css({
      width: '445px',
      '& button': {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
    }),
    tag: css({
      maxWidth: '145px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    secondary: css({
      color: theme.colors.text.secondary,
    }),
    description: css({
      width: '100%',
      gridArea: 'Description',
      margin: theme.spacing(1, 0, 0),
      color: theme.colors.text.secondary,
      lineHeight: theme.typography.body.lineHeight,
    }),
    actions: css({
      marginRight: theme.spacing(1),
    }),
  };
}
