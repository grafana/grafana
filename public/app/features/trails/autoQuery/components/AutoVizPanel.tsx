import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { PanelMenu } from '../../Menu/PanelMenu';
import { getMetricDescription } from '../../helpers/MetricDatasourceHelper';
import { MDP_METRIC_OVERVIEW, trailDS } from '../../shared';
import { getMetricSceneFor, getTrailFor } from '../../utils';
import { AutoQueryDef } from '../types';

import { AutoVizPanelQuerySelector } from './AutoVizPanelQuerySelector';

export interface AutoVizPanelState extends SceneObjectState {
  panel?: VizPanel;
  metric?: string;
}

export class AutoVizPanel extends SceneObjectBase<AutoVizPanelState> {
  constructor(state: AutoVizPanelState) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public onActivate() {
    if (!this.state.panel) {
      const { autoQuery, metric } = getMetricSceneFor(this).state;

      this.getVizPanelFor(autoQuery.main, metric).then((panel) =>
        this.setState({
          panel,
          metric,
        })
      );
    }
  }

  public onChangeQuery = (variant: string) => {
    const metricScene = getMetricSceneFor(this);

    const def = metricScene.state.autoQuery.variants.find((q) => q.variant === variant)!;

    this.getVizPanelFor(def).then((panel) => this.setState({ panel }));
    metricScene.setState({ queryDef: def });
  };

  private async getVizPanelFor(def: AutoQueryDef, metric?: string) {
    const trail = getTrailFor(this);
    const metadata = await trail.getMetricMetadata(metric);
    const description = getMetricDescription(metadata);

    return def
      .vizBuilder()
      .setData(
        new SceneQueryRunner({
          datasource: trailDS,
          maxDataPoints: MDP_METRIC_OVERVIEW,
          queries: def.queries,
        })
      )
      .setDescription(description)
      .setHeaderActions([new AutoVizPanelQuerySelector({ queryDef: def, onChangeQuery: this.onChangeQuery })])
      .setShowMenuAlways(true)
      .setMenu(new PanelMenu({ labelName: metric ?? this.state.metric }))
      .build();
  }

  public static Component = ({ model }: SceneComponentProps<AutoVizPanel>) => {
    const { panel } = model.useState();

    if (!panel) {
      return;
    }
    return <panel.Component model={panel} />;
  };
}
