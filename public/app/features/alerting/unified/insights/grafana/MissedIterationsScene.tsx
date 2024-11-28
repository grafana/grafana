import { Observable, map } from 'rxjs';

import { DataFrame } from '@grafana/data';
import {
  CustomTransformOperator,
  PanelBuilders,
  SceneDataTransformer,
  SceneFlexItem,
  SceneQueryRunner,
} from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { INSTANCE_ID, PANEL_STYLES } from '../../home/Insights';
import { InsightsMenuButton } from '../InsightsMenuButton';

export function getGrafanaMissedIterationsScene(datasource: DataSourceRef, panelTitle: string) {
  const expr = `sum by(rule_group) (grafanacloud_instance_rule_group_iterations_missed_total:rate5m{id="${INSTANCE_ID}"})`;
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr,
        range: true,
        legendFormat: '{{rule_group}}',
      },
    ],
  });

  const legendTransformation: CustomTransformOperator = () => (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((data: DataFrame[]) => {
        return data.map((frame: DataFrame) => {
          return {
            ...frame,
            fields: frame.fields.map((field) => {
              const displayNameFromDs = field.config.displayNameFromDS || '';
              const matches = displayNameFromDs.match(/\/rules\/\d+\/(\w+);(\w+)/);

              if (matches) {
                field.config.displayName = `Folder: ${matches[1]} - Group: ${matches[2]}`;
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
    transformations: [legendTransformation],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('The number of missed iterations per evaluation group')
      .setData(transformation)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setHeaderActions([new InsightsMenuButton({ panel: panelTitle })])
      .build(),
  });
}
