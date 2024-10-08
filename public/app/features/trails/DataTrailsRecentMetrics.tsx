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
        <Card.Heading>
          <div className={styles.metricLabel}>Last metric:</div>
          <div className={styles.metricValue}>{metric}</div>
        </Card.Heading>
        <div className={styles.meta}>
          <Card.Meta separator={'|'}>{filters.map((f) => `${f.key}: ${f.value}`)}</Card.Meta>
        </div>
        <div className={styles.datasource}>
          <div className={styles.secondaryFont}>Datasource: </div>
          <div className={styles.primaryFont}>{datasource && getDataSourceName(datasource)}</div>
        </div>
        <div className={styles.date}>
          <div className={styles.secondaryFont}>Date created: </div>
          <div className={styles.primaryFont}>{createdAt && dateTimeFormat(createdAt, { format: 'YYYY-MM-DD' })}</div>
        </div>
      </Card>
    </div>
  );
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    metricLabel: css({
      display: 'inline',
      color: 'var(--text-secondary, rgba(204, 204, 220, 0.65))',
      fontFamily: 'Inter',
      fontSize: '14px',
      fontStyle: 'normal',
      fontWeight: 400,
      // lineHeight: '22px', /* 157.143% */
      // letterSpacing: '0.021px',
    }),
    metricValue: css({
      display: 'inline',
      color: 'var(--text-primary, #CCCCDC)',
      fontFamily: 'Inter',
      fontSize: '14px',
      fontStyle: 'normal',
      fontWeight: 500,
      marginLeft: '8px', // Add some space between the label and the value
      // lineHeight: '22px', /* 157.143% */
      // letterSpacing: '0.021px',
    }),
    tag: css({
      maxWidth: '260px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    card: css({
      // display: 'flex',
      padding: theme.spacing(1),
      height: '100%',
    }),
    secondary: css({
      color: theme.colors.text.secondary,
      fontSize: '12px',
    }),
    datasource: css({
      gridArea: 'Description',
    }),
    date: css({
      // gridArea: 'Actions',
      position: 'absolute',
      bottom: '0px',
    }),
    meta: css({
      width: '100%',
      gridArea: 'Meta',
      margin: theme.spacing(1, 0, 0),
      color: theme.colors.text.secondary,
      // lineHeight: theme.typography.body.lineHeight,
    }),
    actions: css({
      marginRight: theme.spacing(1),
      // gridArea: 'Actions', // seems to do nothing
    }),
    primaryFont: css({
      display: 'inline',
      color: 'var(--text-primary, #CCCCDC)',
      /* Body Small Bold */
      fontFamily: 'Inter',
      fontSize: '12px',
      fontStyle: 'normal',
      fontWeight: '500',
      lineHeight: '18px' /* 150% */,
      letterSpacing: '0.018px',
    }),
    secondaryFont: css({
      display: 'inline',
      color: 'var(--text-secondary, rgba(204, 204, 220, 0.65))',
      /* Body Small */
      fontFamily: 'Inter',
      fontSize: '12px',
      fontStyle: 'normal',
      fontWeight: '400',
      lineHeight: '18px' /* 150% */,
      letterSpacing: '0.018px',
    }),
  };
}
