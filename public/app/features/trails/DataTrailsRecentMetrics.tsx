import { css } from '@emotion/css';

import { dateTimeFormat, GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState, AdHocFiltersVariable, SceneObjectBase } from '@grafana/scenes';
import { Card, Stack, Tag, useStyles2 } from '@grafana/ui';

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

function RecentExploration({ model }: Props) {
  const styles = useStyles2(getStyles);
  const { metric, datasource, filters, createdAt } = model.useState();
  return (
    <div>
      <Card onClick={onSelect} className={styles.card}>
        {/* <Box display="inline">
          <Text element="p" textAlignment="left" color="secondary">
            <Trans>Last metric: </Trans>
          </Text>
          <Text>
            {metric ? metric : ''}
          </Text>
        </Box> */}
        <div className={styles.metricContainer}>
          <div className={styles.metricLabel}>Last metric:</div>
          <div className={styles.metricValue}>{metric}</div>
        </div>
        {/* <Card.Heading>Last metric: {metric}</Card.Heading> */}
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
    metricContainer: css({
      // display: 'flex',
      // alignItems: 'center',
    }),
    metricLabel: css({
      color: 'var(--text-secondary, rgba(204, 204, 220, 0.65))',
      fontFamily: 'Inter',
      fontSize: '14px',
      fontStyle: 'normal',
      fontWeight: 400,
      // lineHeight: '22px', /* 157.143% */
      // letterSpacing: '0.021px',
    }),
    metricValue: css({
      color: 'var(--text-primary, #CCCCDC)',
      fontFamily: 'Inter',
      fontSize: '14px',
      fontStyle: 'normal',
      fontWeight: 500,
      // lineHeight: '22px', /* 157.143% */
      // letterSpacing: '0.021px',
      // marginLeft: '8px', // Add some space between the label and the value
    }),
    tag: css({
      maxWidth: '260px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    card: css({
      display: 'flex',
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
