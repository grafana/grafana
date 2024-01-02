import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  AdHocFiltersVariable,
  QueryVariable,
  SceneComponentProps,
  SceneFlexItem,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
} from '@grafana/scenes';
import { Stack, useStyles2 } from '@grafana/ui';

import PrometheusLanguageProvider from '../../plugins/datasource/prometheus/language_provider';
import { PromMetricsMetadataItem } from '../../plugins/datasource/prometheus/types';
import { getDatasourceSrv } from '../plugins/datasource_srv';
import { ALL_VARIABLE_VALUE } from '../variables/constants';

import { DataTrail } from './DataTrail';
import { MetricScene } from './MetricScene';
import { trailDS, VAR_DATASOURCE, VAR_FILTERS, VAR_GROUP_BY, VAR_METRIC_EXPR } from './shared';
export interface MetricOverviewSceneState extends SceneObjectState {
  labels: Array<SelectableValue<string>>;
  metadata?: PromMetricsMetadataItem;
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
    const metric = sceneGraph.getAncestor(this, MetricScene).state.metric;
    const dsUid = sceneGraph.getAncestor(this, DataTrail).state.$variables?.getByName(VAR_DATASOURCE)?.getValue();
    let metricMetadata = undefined;
    if (typeof dsUid === 'string') {
      getDatasourceSrv()
        .get(dsUid)
        .then((ds) => {
          const langProvider: PrometheusLanguageProvider = ds.languageProvider;
          langProvider.start().then(() => {
            metricMetadata = langProvider.metricsMetadata?.[metric];
          });
        });
    }

    const variable = this.getVariable();
    variable.subscribeToState((newState, oldState) => {
      if (
        newState.options !== oldState.options ||
        newState.value !== oldState.value ||
        newState.loading !== oldState.loading
      ) {
        const labels = this.getLabelOptions(this.getVariable());
        console.log(labels);
        this.setState({ labels, loading: variable.state.loading });
      }
    });

    this.setState({ metadata: metricMetadata, loading: variable.state.loading });
  }

  private getLabelOptions(variable: QueryVariable) {
    const labelFilters = sceneGraph.lookupVariable(VAR_FILTERS, this);
    const labelOptions: Array<SelectableValue<string>> = [];

    if (!(labelFilters instanceof AdHocFiltersVariable)) {
      return [];
    }

    const filters = labelFilters.state.set.state.filters;

    for (const option of variable.getOptionsForSelect()) {
      const filterExists = filters.find((f) => f.key === option.value);
      if (!filterExists) {
        labelOptions.push({ label: option.label, value: String(option.value) });
      }
    }

    return labelOptions;
  }

  public static Component = ({ model }: SceneComponentProps<MetricOverviewScene>) => {
    const { loading, metadata, labels } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <Stack gap={6}>
        {loading && <div>Loading...</div>}
        <Stack direction="column" gap={0.5}>
          <div className={styles.label}>Description</div>
          {metadata?.help ? <div>{metadata?.help}</div> : <i>No description available</i>}
        </Stack>
        <Stack direction="column" gap={0.5}>
          <div className={styles.label}>Type</div>
          {metadata?.type ? <div>{metadata?.type}</div> : <i>Unknown</i>}
        </Stack>
        <Stack direction="column" gap={0.5}>
          <div className={styles.label}>Labels</div>
          {labels
            .filter((l) => l.value !== ALL_VARIABLE_VALUE)
            .map((l) => (
              <div key={l.label}>{l.label}</div>
            ))}
        </Stack>
      </Stack>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    label: css({
      fontWeight: 'bold',
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
