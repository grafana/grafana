import { Observable, map } from 'rxjs';

import { DataFrame } from '@grafana/data';
import {
  CustomTransformOperator,
  PanelBuilders,
  SceneDataTransformer,
  SceneFlexItem,
  SceneQueryRunner,
  SceneTimeRange,
} from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { PANEL_STYLES } from '../../home/Insights';

export function getGrafanaMissedIterationsScene(
  timeRange: SceneTimeRange,
  datasource: DataSourceRef,
  panelTitle: string
) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: 'sum by (rule_group) (grafanacloud_instance_rule_group_iterations_missed_total:rate5m)',
        range: true,
        legendFormat: '{{rule_group}}',
      },
    ],
    $timeRange: timeRange,
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
      .setDescription(panelTitle)
      .setData(transformation)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .build(),
  });
}
