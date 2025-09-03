import {
  DataProviderProxy,
  EmbeddedScene,
  PanelBuilders,
  SceneDataTransformer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectRef,
  sceneGraph,
} from '@grafana/scenes';
import {
  AxisPlacement,
  GraphDrawStyle,
  LegendDisplayMode,
  LineInterpolation,
  StackingMode,
  TooltipDisplayMode,
  VisibilityMode,
} from '@grafana/schema';

import { overrideToFixedColor } from '../../home/Insights';

import { triageScene } from './TriageScene';

export const getAlertRuleScene = (ruleUID: string) => {
  // Build the timeseries panel and hide its header (hover-only)
  const headerlessPanel = PanelBuilders.timeseries()
    .setTitle('')
    .setHoverHeader(true)
    .setDisplayMode('transparent')
    .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
    .setCustomFieldConfig('lineInterpolation', LineInterpolation.StepBefore)
    .setCustomFieldConfig('showPoints', VisibilityMode.Never)
    .setCustomFieldConfig('fillOpacity', 30)
    .setCustomFieldConfig('stacking', { mode: StackingMode.None })
    .setCustomFieldConfig('axisPlacement', AxisPlacement.Hidden)
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
    .setOption('legend', {
      showLegend: false,
      displayMode: LegendDisplayMode.Hidden,
    })
    .setOverrides((builder) =>
      builder
        .matchFieldsWithName('firing')
        .overrideColor(overrideToFixedColor('firing'))
        .matchFieldsWithName('pending')
        .overrideColor(overrideToFixedColor('pending'))
    )
    .setNoValue('0')
    .build();

  return new EmbeddedScene({
    $data: new SceneDataTransformer({
      $data: new DataProviderProxy({ source: new SceneObjectRef(sceneGraph.getData(triageScene)) }),
      transformations: [
        {
          id: 'filterByValue',
          options: {
            filters: [
              {
                config: {
                  id: 'equal',
                  options: {
                    value: ruleUID,
                  },
                },
                fieldName: 'grafana_rule_uid',
              },
            ],
            match: 'any',
            type: 'include',
          },
        },
        {
          id: 'partitionByValues',
          options: {
            fields: ['alertstate'],
            keepFields: false,
            naming: {
              asLabels: true,
            },
          },
        },
      ],
    }),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 60,
          body: headerlessPanel,
        }),
      ],
    }),
  });
};

export function AlertRuleStateChart({ ruleUID }: { ruleUID: string }) {
  const alertRuleScene = getAlertRuleScene(ruleUID);

  if (!alertRuleScene) {
    return null;
  }

  return <alertRuleScene.Component model={alertRuleScene} />;
}
