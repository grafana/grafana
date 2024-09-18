import { dateTimeFormat } from '@grafana/data';
import { SceneObjectState, AdHocFiltersVariable, SceneObjectBase } from '@grafana/scenes';
import { Card, Stack, Tag, IconButton, useStyles2 } from '@grafana/ui';

import { getStyles } from './DataTrailCard';
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
        <Card.Heading>{metric}</Card.Heading>
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
              <b>Datasource:</b> {datasource && getDataSourceName(datasource)}
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
      <div>
        Recent Exploration metric: {metric}, datasource: {datasource}, filters: {JSON.stringify(filters)}, createdAt:{' '}
        {createdAt}, time range from: {$timeRange && $timeRange.state.from}, time range to:{' '}
        {$timeRange && $timeRange.state.to}
      </div>
      ;
    </div>
    // add time range, add sparklines
  );
}
