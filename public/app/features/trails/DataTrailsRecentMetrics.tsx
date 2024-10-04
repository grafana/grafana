import { css } from '@emotion/css';

import { dateTimeFormat, GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState, AdHocFiltersVariable, SceneObjectBase } from '@grafana/scenes';
import { Card, Stack, Tag, IconButton, useStyles2 } from '@grafana/ui';

// import { getStyles } from './DataTrailCard';

import { getDataSourceName } from './utils';

type Filters = AdHocFiltersVariable['state']['filters']; // type is actually AdHocFilterWithLabels[]

export interface RecentExplorationState extends SceneObjectState {
  metric?: string;
  datasource?: string;
  filters: Filters;
  createdAt: number;
}

export class RecentExplorationScene extends SceneObjectBase<RecentExplorationState> {
  static Component = RecentExploration;
}

type Props = { model: RecentExplorationScene };

function onSelect() {
  alert('select');
}
function onDelete() {
  alert('delete');
}

function RecentExploration({ model }: Props) {
  const styles = useStyles2(getStyles);
  const { metric, datasource, filters, createdAt, $timeRange } = model.useState();
  return (
    <div>
      {/* <DataTrailCard
                key={(resolvedTrail.state.key || '') + index}
                trail={resolvedTrail}
                onSelect={() => model.onSelectRecentTrail(resolvedTrail)}
            /> */}
      <Card onClick={onSelect} className={styles.card}>
        <Card.Heading>Last metric: {metric}</Card.Heading>
        <div className={styles.description}>
          <Stack gap={1.5} wrap="wrap">
            {filters.map((f) => (
              <Tag key={f.key} name={`${f.key}: ${f.value}`} colorIndex={12} /> // Labels / filters
            ))}
          </Stack>
        </div>
        <Card.Actions className={styles.actions}>
          <Stack gap={1} justifyContent={'space-between'} grow={1}>
            <div className={styles.secondary}>
              <b>Datasource:</b> {datasource && getDataSourceName(datasource)}
            </div>
            {createdAt && (
              <i className={styles.secondary}>
                <b>Date created:</b> {dateTimeFormat(createdAt, { format: 'LL' })}
              </i>
            )}
          </Stack>
        </Card.Actions>
      </Card>
      {/* <div>
        Recent Exploration metric: {metric}, datasource: {datasource}, filters: {JSON.stringify(filters)}, createdAt:{' '}
        {createdAt}, time range from: {$timeRange && $timeRange.state.from}, time range to:{' '}
        {$timeRange && $timeRange.state.to}
      </div> */}
    </div>
    // REACH TODO: add sparklines
  );
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    tag: css({
      maxWidth: '260px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    card: css({
      padding: theme.spacing(1),
      height: '100%',
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
