import { Observable, map } from 'rxjs';

import { DataFrame, Field } from '@grafana/data';
import {
  CustomTransformOperator,
  PanelBuilders,
  SceneDataTransformer,
  SceneFlexItem,
  SceneQueryRunner,
} from '@grafana/scenes';
import { DataSourceRef, TableCellDisplayMode } from '@grafana/schema';
import { CustomCellRendererProps, TextLink } from '@grafana/ui';

import { PANEL_STYLES } from '../../home/Insights';
import { createRelativeUrl } from '../../utils/url';
import { InsightsMenuButton } from '../InsightsMenuButton';

const RULE_UID_FIELD_NAME = 'ruleUID';
const ALERT_NAME_FIELD_NAME = 'labels_alertname';
const VALUE_FIELD_NAME = 'Value #A';

export function getMostFiredInstancesScene(datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: `topk(10, sum by(${ALERT_NAME_FIELD_NAME}, ${RULE_UID_FIELD_NAME}) (count_over_time({from="state-history"} | json | current = \`Alerting\` [1w])))`,
        instant: true,
      },
    ],
  });

  const createRuleLink = (field: Field<string>): Field<string> => {
    return {
      ...field,
      config: {
        custom: {
          cellOptions: {
            type: TableCellDisplayMode.Custom,
            cellComponent: RuleLink,
          },
        },
      },
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
              if (field.name === ALERT_NAME_FIELD_NAME) {
                return createRuleLink(field);
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
              field: VALUE_FIELD_NAME,
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
            [RULE_UID_FIELD_NAME]: false,
          },
          indexByName: {
            [ALERT_NAME_FIELD_NAME]: 0,
            [RULE_UID_FIELD_NAME]: 1,
            [VALUE_FIELD_NAME]: 2,
          },
          renameByName: {
            [ALERT_NAME_FIELD_NAME]: 'Alert rule name',
            [VALUE_FIELD_NAME]: 'Number of fires',
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
      .setOverrides((builder) =>
        // Hide the rule UID field, if we omit it in a transformation the custom cell renderer will not work
        builder
          .matchFieldsWithName(RULE_UID_FIELD_NAME)
          .overrideCustomFieldConfig('hideFrom', { viz: true, legend: false, tooltip: false })
      )
      .build(),
  });
}

export function RuleLink({ value, frame, rowIndex }: CustomCellRendererProps) {
  const ruleUIDs = frame.fields.find((field) => field.name === RULE_UID_FIELD_NAME);
  const ruleUID = ruleUIDs?.values[rowIndex];

  return (
    <TextLink color="primary" external href={createRelativeUrl(`/alerting/grafana/${ruleUID}/view`)} inline={false}>
      {String(value)}
    </TextLink>
  );
}
