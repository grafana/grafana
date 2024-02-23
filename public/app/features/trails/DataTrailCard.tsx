import { css } from '@emotion/css';
import React from 'react';

import { dateTimeFormat, GrafanaTheme2 } from '@grafana/data';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';
import { Card, IconButton, Stack, Tag, useStyles2 } from '@grafana/ui';

import { DataTrail } from './DataTrail';
import { VAR_FILTERS } from './shared';
import { getDataSource, getDataSourceName, getMetricName } from './utils';

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

  const filters = filtersVariable.state.filters;
  const dsValue = getDataSource(trail);

  const onClick = () => onSelect(trail);

  return (
    <Card onClick={onClick} className={styles.card}>
      <Card.Heading>{getMetricName(trail.state.metric)}</Card.Heading>
      <div className={styles.description}>
        <Stack gap={1.5}>
          {filters.map((f) => (
            <Tag key={f.key} name={`${f.key}: ${f.value}`} colorIndex={12} />
          ))}
        </Stack>
      </div>
      <Card.Actions className={styles.actions}>
        <Stack gap={1} justifyContent={'space-between'} grow={1}>
          <div className={styles.secondary}>
            <b>Datasource:</b> {getDataSourceName(dsValue)}
          </div>
          {trail.state.createdAt && (
            <i className={styles.secondary}>
              <b>Created:</b> {dateTimeFormat(trail.state.createdAt, { format: 'LL' })}
            </i>
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

function getStyles(theme: GrafanaTheme2) {
  return {
    tag: css({
      maxWidth: '260px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    card: css({
      padding: theme.spacing(1),
    }),
    secondary: css({
      color: theme.colors.text.secondary,
      fontSize: '12px',
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
