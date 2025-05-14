import { css } from '@emotion/css';
import { Observable, map } from 'rxjs';

import { DataFrame, Field, GrafanaTheme2 } from '@grafana/data';
import {
  CustomTransformOperator,
  PanelBuilders,
  SceneDataTransformer,
  SceneFlexItem,
  SceneQueryRunner,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';
import { Link, useStyles2 } from '@grafana/ui';

import { PANEL_STYLES } from '../../home/Insights';
import { createRelativeUrl } from '../../utils/url';
import { InsightsMenuButton } from '../InsightsMenuButton';

export function getMostFiredInstancesScene(datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: 'topk(10, sum by(labels_alertname, ruleUID) (count_over_time({from="state-history"} | json | current = `Alerting` [1w])))',
        instant: true,
      },
    ],
  });

  const createRuleLink = (field: Field<string>, frame: DataFrame) => {
    return {
      ...field,
      values: field.values.map((value, index) => {
        const ruleUIDs = frame.fields.find((field) => field.name === 'ruleUID');
        const ruleUID = ruleUIDs?.values[index];
        return <RuleLink key={value} value={value} ruleUID={ruleUID} />;
      }),
    };
  };

  const ruleLinkTransformation: CustomTransformOperator = () => (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((data: DataFrame[]) => {
        return data.map((frame: DataFrame) => {
          return {
            ...frame,
            fields: frame.fields.map((field) => {
              //Transforming the column `labels_alertname` to show a link to the rule view page next to the alert name
              if (field.name === 'labels_alertname') {
                return createRuleLink(field, frame);
              }
              return field;
            }),
          };
        });
      })
    );
  };

  const transformation = new SceneDataTransformer({
    $data: query,
    transformations: [
      ruleLinkTransformation,
      {
        id: 'sortBy',
        options: {
          fields: {},
          sort: [
            {
              field: 'Value #A',
              desc: true,
            },
          ],
        },
      },
      {
        id: 'organize',
        options: {
          excludeByName: {
            Time: true,
            ruleUID: true,
          },
          indexByName: {
            labels_alertname: 0,
            'Value #A': 1,
          },
          renameByName: {
            labels_alertname: 'Alert rule name',
            'Value #A': 'Number of fires',
          },
        },
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.table()
      .setTitle(panelTitle)
      .setDescription('The alert rule instances that have fired the most')
      .setData(transformation)
      .setNoValue('No new alerts fired last week')
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}

export function RuleLink({ value, ruleUID }: { value: string; ruleUID: string }) {
  const getStyles = (theme: GrafanaTheme2) => ({
    link: css({
      '& > a': {
        color: theme.colors.text.link,
      },
    }),
  });

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.link}>
      <Link target="_blank" href={createRelativeUrl(`/alerting/grafana/${ruleUID}/view`)}>
        {value}
      </Link>
    </div>
  );
}
