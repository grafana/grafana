import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { dateTimeFormat, GrafanaTheme2 } from '@grafana/data';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';
import { Card, IconButton, Stack, Tag, useStyles2 } from '@grafana/ui';

import { DataTrail } from './DataTrail';
import { getTrailStore, DataTrailBookmark } from './TrailStore/TrailStore';
import { VAR_FILTERS } from './shared';
import { getDataSource, getDataSourceName, getMetricName } from './utils';

export type Props = {
  trail?: DataTrail;
  bookmark?: DataTrailBookmark;
  onSelect: () => void;
  onDelete?: () => void;
};

export function DataTrailCard(props: Props) {
  const { onSelect, onDelete, bookmark } = props;
  const styles = useStyles2(getStyles);

  const values = useMemo(() => {
    let trail = props.trail || (bookmark && getTrailStore().getTrailForBookmark(bookmark));

    if (!trail) {
      return null;
    }

    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, trail)!;
    if (!(filtersVariable instanceof AdHocFiltersVariable)) {
      return null;
    }

    const createdAt = bookmark?.createdAt || trail.state.createdAt;

    return {
      dsValue: getDataSource(trail),
      filters: filtersVariable.state.filters,
      metric: trail.state.metric,
      createdAt,
    };
  }, [props.trail, bookmark]);

  if (!values) {
    return null;
  }

  const { dsValue, filters, metric, createdAt } = values;

  return (
    <Card onClick={onSelect} className={styles.card}>
      <Card.Heading>{getMetricName(metric)}</Card.Heading>
      <div className={styles.description}>
        <Stack gap={1.5} wrap="wrap">
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
          {createdAt && (
            <i className={styles.secondary}>
              <b>Created:</b> {dateTimeFormat(createdAt, { format: 'LL' })}
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
