import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  PanelBuilders,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { HeatmapColorMode } from 'app/plugins/panel/heatmap/panelcfg.gen';

import { KEY_SQR_METRIC_VIZ_QUERY, trailDS } from '../shared';
import { getTrailSettings } from '../utils';

import { AutoQueryDef, AutoQueryVariant } from './AutoQueryEngine';

export interface AutoVizPanelState extends SceneObjectState {
  panel?: VizPanel;
  queries: AutoQueryDef[];
  queryDef?: AutoQueryDef;
}

export class AutoVizPanel extends SceneObjectBase<AutoVizPanelState> {
  constructor(state: AutoVizPanelState) {
    super(state);

    if (!state.panel) {
      this.setState({
        panel: this.getVizPanelFor(state.queries[0]),
        queryDef: state.queries[0],
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
      queryDef: def,
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
            scheme: 'Spectral',
            steps: 32,
            reverse: false,
          })
          .setHeaderActions(this.getQuerySelector(def))
          .setData(
            new SceneQueryRunner({
              key: KEY_SQR_METRIC_VIZ_QUERY,
              datasource: trailDS,
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
              datasource: trailDS,
              queries: [def.query],
            })
          )
          .build();
    }
  }

  public static Component = ({ model }: SceneComponentProps<AutoVizPanel>) => {
    const { panel, queryDef } = model.useState();
    const { showQuery } = getTrailSettings(model).useState();
    const styles = useStyles2(getStyles);

    if (!panel) {
      return;
    }

    if (!showQuery) {
      return <panel.Component model={panel} />;
    }

    return (
      <div className={styles.wrapper}>
        <Field label="Query">
          <span>{queryDef?.query.expr ?? 'No query'}</span>
        </Field>
        <div className={styles.panel}>
          <panel.Component model={panel} />
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    panel: css({
      position: 'relative',
      flexGrow: 1,
    }),
  };
}
