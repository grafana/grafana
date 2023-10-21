import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  PanelBuilders,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';
import { HeatmapColorMode } from 'app/plugins/panel/heatmap/panelcfg.gen';

import { KEY_SQR_METRIC_VIZ_QUERY, metricDS } from '../shared';

import { AutoQueryDef, AutoQueryVariant } from './AutoQueryEngine';

export interface AutoVizPanelState extends SceneObjectState {
  panel?: VizPanel;
  queries: AutoQueryDef[];
  current?: AutoQueryVariant;
}

export class AutoVizPanel extends SceneObjectBase<AutoVizPanelState> {
  constructor(state: AutoVizPanelState) {
    super(state);

    if (!state.panel) {
      this.setState({
        panel: this.getVizPanelFor(state.queries[0]),
        current: state.queries[0].variant,
      });
    }
  }

  private getQuerySelector(def: AutoQueryDef) {
    if (this.state.queries.length < 2) {
      return;
    }

    const options = this.state.queries.map((q) => ({ label: q.variant, value: q.variant }));

    return <RadioButtonGroup size="sm" options={options} value={def.variant} onChange={this.onChangeQuery} />;
  }

  public onChangeQuery = (variant: AutoQueryVariant) => {
    const def = this.state.queries.find((q) => q.variant === variant)!;

    this.setState({
      panel: this.getVizPanelFor(def),
      current: variant,
    });
  };

  private getVizPanelFor(def: AutoQueryDef) {
    switch (def.variant) {
      case 'heatmap': {
        return PanelBuilders.heatmap()
          .setTitle(def.title)
          .setUnit(def.unit)
          .setOption('calculate', false)
          .setOption('color', {
            mode: HeatmapColorMode.Scheme,
            exponent: 0.5,
            scheme: 'OrRd',
            steps: 66,
            reverse: false,
          })
          .setHeaderActions(this.getQuerySelector(def))
          .setData(
            new SceneQueryRunner({
              key: KEY_SQR_METRIC_VIZ_QUERY,
              datasource: metricDS,
              queries: [def.query],
            })
          )
          .build();
      }
      default:
        return PanelBuilders.timeseries()
          .setTitle(def.title)
          .setUnit(def.unit)
          .setOption('legend', { showLegend: false })
          .setCustomFieldConfig('fillOpacity', 9)
          .setHeaderActions(this.getQuerySelector(def))
          .setData(
            new SceneQueryRunner({
              key: KEY_SQR_METRIC_VIZ_QUERY,
              datasource: metricDS,
              queries: [def.query],
            })
          )
          .build();
    }
  }

  public static Component = ({ model }: SceneComponentProps<AutoVizPanel>) => {
    const { panel } = model.useState();

    if (!panel) {
      return;
    }

    return <panel.Component model={panel} />;
  };
}
