import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  QueryVariable,
  SceneComponentProps,
  SceneFlexItem,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
} from '@grafana/scenes';
import { Stack, useStyles2 } from '@grafana/ui';

import PrometheusLanguageProvider from '../../../plugins/datasource/prometheus/language_provider';
import { PromMetricsMetadataItem } from '../../../plugins/datasource/prometheus/types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { ALL_VARIABLE_VALUE } from '../../variables/constants';
import { DataTrail } from '../DataTrail';
import { MetricScene } from '../MetricScene';
import { trailDS, VAR_DATASOURCE, VAR_DATASOURCE_EXPR, VAR_GROUP_BY, VAR_METRIC_EXPR } from '../shared';
import { getMetricSceneFor } from '../utils';

import { getLabelOptions } from './utils';

export interface MetricOverviewSceneState extends SceneObjectState {
  labels: Array<SelectableValue<string>>;
  metadata?: PromMetricsMetadataItem;
  languageProvider?: PrometheusLanguageProvider;
  loading?: boolean;
}

export class MetricOverviewScene extends SceneObjectBase<MetricOverviewSceneState> {
  constructor(state: Partial<MetricOverviewSceneState>) {
    super({
      $variables: state.$variables ?? getVariableSet(),
      labels: state.labels ?? [],
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private getVariable(): QueryVariable {
    const variable = sceneGraph.lookupVariable(VAR_GROUP_BY, this)!;
    if (!(variable instanceof QueryVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private _onActivate() {
    const metricScene = getMetricSceneFor(this);
    this.updateMetadata();
    this.updateLanguageProvider();

    metricScene.subscribeToState((newState, oldState) => {
      if (newState.metric !== oldState.metric) {
        this.updateMetadata();
      }
    });

    const variable = this.getVariable();
    variable.subscribeToState((newState, oldState) => {
      if (newState.options !== oldState.options || newState.loading !== oldState.loading) {
        const labels = getLabelOptions(this, this.getVariable()).filter((l) => l.value !== ALL_VARIABLE_VALUE);
        this.setState({ labels, loading: variable.state.loading });
      }
    });

    this.setState({ loading: variable.state.loading });
  }

  private async updateLanguageProvider() {
    const ds = await getDatasourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: this } });

    const languageProvider: PrometheusLanguageProvider = ds.languageProvider;
    this.setState({ languageProvider });
  }

  private updateMetadata() {
    const metricScene = getMetricSceneFor(this);
    const metric = metricScene.state.metric;
    const dsUid = sceneGraph.getAncestor(this, DataTrail).state.$variables?.getByName(VAR_DATASOURCE)?.getValue();
    if (typeof dsUid === 'string') {
      getDatasourceSrv()
        .get(dsUid)
        .then((ds) => {
          const langProvider: PrometheusLanguageProvider = ds.languageProvider;
          if (langProvider.metricsMetadata) {
            this.setState({ metadata: langProvider.metricsMetadata[metric] });
          } else {
            langProvider.start().then(() => {
              this.setState({ metadata: langProvider.metricsMetadata?.[metric] });
            });
          }
        });
    }
  }

  public static Component = ({ model }: SceneComponentProps<MetricOverviewScene>) => {
    const { loading, metadata, labels } = model.useState();
    const styles = useStyles2(getStyles);
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const labelVariable = model.getVariable();

    const labelOnClick = (label?: string) => {
      if (label) {
        metricScene.setActionView('breakdown');
        labelVariable?.changeValueTo(label);
      }
    };

    return (
      <Stack gap={6}>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <Stack direction="column" gap={0.5}>
              <div className={styles.label}>Description</div>
              {metadata?.help ? <div>{metadata?.help}</div> : <i>No description available</i>}
            </Stack>
            <Stack direction="column" gap={0.5}>
              <div className={styles.label}>Type</div>
              {metadata?.type ? <div>{metadata?.type}</div> : <i>Unknown</i>}
            </Stack>
            <Stack direction="column" gap={0.5}>
              <div className={styles.label}>Unit</div>
              {metadata?.unit ? <div>{metadata?.unit}</div> : <i>Unknown</i>}
            </Stack>
            <Stack direction="column" gap={0.5}>
              <div className={styles.label}>Labels</div>
              {labels.map((l) => (
                <button key={l.label} className={styles.labelButton} onClick={() => labelOnClick(l.value)}>
                  {l.label}
                </button>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    label: css({
      fontWeight: 'bold',
    }),
    labelButton: css({
      background: 'none',
      border: 'none',
      textAlign: 'left',
      padding: 0,
      ':hover': {
        textDecoration: 'underline',
        cursor: 'pointer',
      },
    }),
  };
}

export function buildMetricOverviewScene() {
  return new SceneFlexItem({
    body: new MetricOverviewScene({}),
  });
}

function getVariableSet() {
  return new SceneVariableSet({
    variables: [
      new QueryVariable({
        name: VAR_GROUP_BY,
        label: 'Group by',
        datasource: trailDS,
        includeAll: true,
        defaultToAll: true,
        query: { query: `label_names(${VAR_METRIC_EXPR})`, refId: 'A' },
        value: '',
        text: '',
      }),
    ],
  });
}
