import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  QueryVariable,
  SceneComponentProps,
  SceneFlexItem,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Stack, useStyles2, TextLink } from '@grafana/ui';

import PrometheusLanguageProvider from '../../../plugins/datasource/prometheus/language_provider';
import { PromMetricsMetadataItem } from '../../../plugins/datasource/prometheus/types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { ALL_VARIABLE_VALUE } from '../../variables/constants';
import { trailDS, VAR_DATASOURCE_EXPR, VAR_GROUP_BY, VAR_METRIC_EXPR } from '../shared';
import { getMetricSceneFor } from '../utils';

import { getLabelOptions } from './utils';

export interface MetricOverviewSceneState extends SceneObjectState {
  metadata?: PromMetricsMetadataItem;
  loading?: boolean;
}

export class MetricOverviewScene extends SceneObjectBase<MetricOverviewSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE_EXPR],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this)
  });

  constructor(state: Partial<MetricOverviewSceneState>) {
    super({
      $variables: state.$variables ?? getVariableSet(),
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
    this.updateMetadata();

    const metricScene = getMetricSceneFor(this);
    metricScene.subscribeToState((newState, oldState) => {
      if (newState.metric !== oldState.metric) {
        this.updateMetadata();
      }
    });
  }

  private onReferencedVariableValueChanged() {
    this.updateMetadata();
  }

  private async updateMetadata() {
    const ds = await getDatasourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: this } });

    const languageProvider: PrometheusLanguageProvider = ds.languageProvider;

    if (!languageProvider) {
      return;
    }

    const metricScene = getMetricSceneFor(this);
    const metric = metricScene.state.metric;

    if (languageProvider.metricsMetadata) {
      this.setState({ metadata: languageProvider.metricsMetadata[metric] });
      return;
    }

    await languageProvider.start();

    this.setState({ metadata: languageProvider.metricsMetadata?.[metric] });
  }

  public static Component = ({ model }: SceneComponentProps<MetricOverviewScene>) => {
    const { metadata } = model.useState();
    const styles = useStyles2(getStyles);
    const variable = model.getVariable();
    const { loading } = variable.useState();
    const labelOptions = getLabelOptions(model, variable).filter((l) => l.value !== ALL_VARIABLE_VALUE);

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
              {labelOptions.map((l) => (
                <TextLink key={l.label} href={sceneGraph.interpolate(model, `/data-trails/trail$\{__url.params:exclude:actionView}&actionView=breakdown&var-groupby=${encodeURIComponent(l.value!)}`)} title="View breakdown">
                  {l.label!}
                </TextLink>
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
