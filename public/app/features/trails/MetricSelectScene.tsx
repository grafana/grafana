import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  PanelBuilders,
  SceneFlexItem,
  SceneVariableSet,
  QueryVariable,
  sceneGraph,
  VariableDependencyConfig,
  SceneVariable,
  SceneCSSGridLayout,
  SceneCSSGridItem,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { Input, Text, useStyles2, InlineSwitch } from '@grafana/ui';

import { getAutoQueriesForMetric } from './AutomaticMetricQueries/AutoQueryEngine';
import { SelectMetricAction } from './SelectMetricAction';
import { getVariablesWithMetricConstant, trailDS, VAR_FILTERS_EXPR, VAR_METRIC_NAMES } from './shared';
import { getColorByIndex } from './utils';

export interface MetricSelectSceneState extends SceneObjectState {
  body: SceneCSSGridLayout;
  showHeading?: boolean;
  searchQuery?: string;
  showPreviews?: boolean;
}

const ROW_PREVIEW_HEIGHT = '175px';
const ROW_CARD_HEIGHT = '64px';

export class MetricSelectScene extends SceneObjectBase<MetricSelectSceneState> {
  constructor(state: Partial<MetricSelectSceneState>) {
    super({
      $variables: state.$variables ?? getMetricNamesVariableSet(),
      body:
        state.body ??
        new SceneCSSGridLayout({
          children: [],
          templateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
          autoRows: ROW_PREVIEW_HEIGHT,
        }),
      showPreviews: true,
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_METRIC_NAMES],
    onVariableUpdatesCompleted: this._onVariableChanged.bind(this),
  });

  private _onVariableChanged(changedVariables: Set<SceneVariable>, dependencyChanged: boolean): void {
    if (dependencyChanged) {
      this.buildLayout();
    }
  }

  private ignoreNextUpdate = false;
  private _onActivate() {
    if (this.state.body.state.children.length === 0) {
      this.buildLayout();
    } else {
      // Temp hack when going back to select metric scene and variable updates
      this.ignoreNextUpdate = true;
    }
  }

  private buildLayout() {
    // Temp hack when going back to select metric scene and variable updates
    if (this.ignoreNextUpdate) {
      this.ignoreNextUpdate = false;
      return;
    }

    const variable = sceneGraph.lookupVariable(VAR_METRIC_NAMES, this);

    if (!(variable instanceof QueryVariable)) {
      return;
    }

    if (variable.state.loading) {
      return;
    }

    const searchRegex = new RegExp(this.state.searchQuery ?? '.*');
    const metricNames = variable.state.options;
    const children: SceneFlexItem[] = [];
    const showPreviews = this.state.showPreviews;
    const previewLimit = 20;
    const cardLimit = 50;

    for (let index = 0; index < metricNames.length; index++) {
      const metric = metricNames[index];

      const metricName = String(metric.value);
      if (!metricName.match(searchRegex)) {
        continue;
      }

      if (children.length > cardLimit) {
        break;
      }

      if (showPreviews && children.length < previewLimit) {
        children.push(
          new SceneCSSGridItem({
            $variables: getVariablesWithMetricConstant(metricName),
            body: getPreviewPanelFor(metricName, index),
          })
        );
      } else {
        children.push(
          new SceneCSSGridItem({
            $variables: getVariablesWithMetricConstant(metricName),
            body: getCardPanelFor(metricName),
          })
        );
      }
    }

    const rowTemplate = this.state.showPreviews ? ROW_PREVIEW_HEIGHT : ROW_CARD_HEIGHT;

    this.state.body.setState({ children, autoRows: rowTemplate });
  }

  public onSearchChange = (evt: React.SyntheticEvent<HTMLInputElement>) => {
    this.setState({ searchQuery: evt.currentTarget.value });
    this.buildLayout();
  };

  public onTogglePreviews = () => {
    this.setState({ showPreviews: !this.state.showPreviews });
    this.buildLayout();
  };

  public static Component = ({ model }: SceneComponentProps<MetricSelectScene>) => {
    const { showHeading, searchQuery, showPreviews } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        {showHeading && (
          <div className={styles.headingWrapper}>
            <Text variant="h4">Select a metric</Text>
          </div>
        )}
        <div className={styles.header}>
          <Input placeholder="Search metrics" value={searchQuery} onChange={model.onSearchChange} />
          <InlineSwitch showLabel={true} label="Show previews" value={showPreviews} onChange={model.onTogglePreviews} />
        </div>
        <model.state.body.Component model={model.state.body} />
      </div>
    );
  };
}

function getMetricNamesVariableSet() {
  return new SceneVariableSet({
    variables: [
      new QueryVariable({
        name: VAR_METRIC_NAMES,
        datasource: trailDS,
        hide: VariableHide.hideVariable,
        includeAll: true,
        defaultToAll: true,
        skipUrlSync: true,
        query: { query: `label_values(${VAR_FILTERS_EXPR},__name__)`, refId: 'A' },
      }),
    ],
  });
}

function getPreviewPanelFor(metric: string, index: number) {
  const autoQuery = getAutoQueriesForMetric(metric);

  return autoQuery.preview
    .vizBuilder(autoQuery.preview)
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
    .setHeaderActions(new SelectMetricAction({ metric, title: 'Select' }))
    .build();
}

function getCardPanelFor(metric: string) {
  return PanelBuilders.text()
    .setTitle(metric)
    .setHeaderActions(new SelectMetricAction({ metric, title: 'Select' }))
    .setOption('content', '')
    .build();
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    headingWrapper: css({
      marginTop: theme.spacing(1),
    }),
    header: css({
      flexGrow: 0,
      display: 'flex',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(1),
    }),
  };
}
