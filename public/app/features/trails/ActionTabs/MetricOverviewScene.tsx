import React from 'react';

import {
  QueryVariable,
  SceneComponentProps,
  SceneFlexItem,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Stack, Text, TextLink } from '@grafana/ui';

import PrometheusLanguageProvider from '../../../plugins/datasource/prometheus/language_provider';
import { PromMetricsMetadataItem } from '../../../plugins/datasource/prometheus/types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { ALL_VARIABLE_VALUE } from '../../variables/constants';
import { TRAILS_ROUTE, VAR_DATASOURCE_EXPR, VAR_GROUP_BY } from '../shared';
import { getMetricSceneFor } from '../utils';

import { getLabelOptions } from './utils';

export interface MetricOverviewSceneState extends SceneObjectState {
  metadata?: PromMetricsMetadataItem;
  loading?: boolean;
}

export class MetricOverviewScene extends SceneObjectBase<MetricOverviewSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE_EXPR],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  constructor(state: Partial<MetricOverviewSceneState>) {
    super({
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
              <Text weight={'medium'}>Description</Text>
              <div style={{ maxWidth: 360 }}>
                {metadata?.help ? <div>{metadata?.help}</div> : <i>No description available</i>}
              </div>
            </Stack>
            <Stack direction="column" gap={0.5}>
              <Text weight={'medium'}>Type</Text>
              {metadata?.type ? <div>{metadata?.type}</div> : <i>Unknown</i>}
            </Stack>
            <Stack direction="column" gap={0.5}>
              <Text weight={'medium'}>Unit</Text>
              {metadata?.unit ? <div>{metadata?.unit}</div> : <i>Unknown</i>}
            </Stack>
            <Stack direction="column" gap={0.5}>
              <Text weight={'medium'}>Labels</Text>
              {labelOptions.map((l) => (
                <TextLink
                  key={l.label}
                  href={sceneGraph.interpolate(
                    model,
                    `${TRAILS_ROUTE}$\{__url.params:exclude:actionView,var-groupby}&actionView=breakdown&var-groupby=${encodeURIComponent(
                      l.value!
                    )}`
                  )}
                  title="View breakdown"
                >
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

export function buildMetricOverviewScene() {
  return new SceneFlexItem({
    body: new MetricOverviewScene({}),
  });
}
