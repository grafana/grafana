import { css } from '@emotion/css';
import leven from 'leven';
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
  SceneObjectRef,
  SceneQueryRunner,
  VariableValueOption,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { Input, Text, useStyles2, InlineSwitch } from '@grafana/ui';

import { getAutoQueriesForMetric } from './AutomaticMetricQueries/AutoQueryEngine';
import { SelectMetricAction } from './SelectMetricAction';
import { hideEmptyPreviews } from './hideEmptyPreviews';
import { getVariablesWithMetricConstant, trailDS, VAR_FILTERS_EXPR, VAR_METRIC_NAMES } from './shared';
import { getColorByIndex, getTrailFor } from './utils';

interface MetricPanel {
  name: string;
  index: number;
  itemRef?: SceneObjectRef<SceneCSSGridItem>;
  isEmpty?: boolean;
  isPanel?: boolean;
  loaded?: boolean;
}

export interface MetricSelectSceneState extends SceneObjectState {
  body: SceneCSSGridLayout;
  showHeading?: boolean;
  searchQuery?: string;
  showPreviews?: boolean;
}

const ROW_PREVIEW_HEIGHT = '175px';
const ROW_CARD_HEIGHT = '64px';

export class MetricSelectScene extends SceneObjectBase<MetricSelectSceneState> {
  private previewCache: Record<string, MetricPanel> = {};

  constructor(state: Partial<MetricSelectSceneState>) {
    super({
      $variables: state.$variables ?? getMetricNamesVariableSet(),
      body:
        state.body ??
        new SceneCSSGridLayout({
          children: [],
          templateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
          autoRows: ROW_PREVIEW_HEIGHT,
          isLazy: true,
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
      this.updateMetrics();
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

  private sortedPreviewMetrics() {
    return Object.values(this.previewCache).sort((a, b) => {
      if (a.isEmpty && b.isEmpty) {
        return a.index - b.index;
      }
      if (a.isEmpty) {
        return 1;
      }
      if (b.isEmpty) {
        return -1;
      }
      return a.index - b.index;
    });
  }

  private updateMetrics() {
    const trail = getTrailFor(this);
    const variable = sceneGraph.lookupVariable(VAR_METRIC_NAMES, this);

    if (!(variable instanceof QueryVariable)) {
      return;
    }

    if (variable.state.loading) {
      return;
    }

    const searchRegex = new RegExp(this.state.searchQuery ?? '.*');
    const metricNames = variable.state.options;
    const sortedMetricNames =
      trail.state.metric !== undefined ? sortRelatedMetrics(metricNames, trail.state.metric) : metricNames;
    const metricsMap: Record<string, MetricPanel> = {};
    const metricsLimit = 120;

    for (let index = 0; index < sortedMetricNames.length; index++) {
      const metric = sortedMetricNames[index];

      const metricName = String(metric.value);
      if (!metricName.match(searchRegex)) {
        continue;
      }

      if (Object.keys(metricsMap).length > metricsLimit) {
        break;
      }

      metricsMap[metricName] = { name: metricName, index, loaded: false };
    }

    this.previewCache = metricsMap;
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

    if (!Object.keys(this.previewCache).length) {
      this.updateMetrics();
    }

    const children: SceneFlexItem[] = [];

    const metricsList = this.sortedPreviewMetrics();
    for (let index = 0; index < metricsList.length; index++) {
      const metric = metricsList[index];

      if (metric.itemRef && metric.isPanel) {
        children.push(metric.itemRef.resolve());
        continue;
      }
      if (this.state.showPreviews) {
        const panel = getPreviewPanelFor(metric.name, index);
        metric.itemRef = panel.getRef();
        metric.isPanel = true;
        children.push(panel);
      } else {
        const panel = new SceneCSSGridItem({
          $variables: getVariablesWithMetricConstant(metric.name),
          body: getCardPanelFor(metric.name),
        });
        metric.itemRef = panel.getRef();
        metric.isPanel = false;
        children.push(panel);
      }
    }

    const rowTemplate = this.state.showPreviews ? ROW_PREVIEW_HEIGHT : ROW_CARD_HEIGHT;

    this.state.body.setState({ children, autoRows: rowTemplate });
  }

  public updateMetricPanel = (metric: string, isLoaded?: boolean, isEmpty?: boolean) => {
    const metricPanel = this.previewCache[metric];
    if (metricPanel) {
      metricPanel.isEmpty = isEmpty;
      metricPanel.loaded = isLoaded;
      this.previewCache[metric] = metricPanel;
      this.buildLayout();
    }
  };

  public onSearchChange = (evt: React.SyntheticEvent<HTMLInputElement>) => {
    this.setState({ searchQuery: evt.currentTarget.value });
    this.updateMetrics();
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

  const vizPanel = autoQuery.preview
    .vizBuilder()
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
    .setHeaderActions(new SelectMetricAction({ metric, title: 'Select' }))
    .build();

  return new SceneCSSGridItem({
    $variables: getVariablesWithMetricConstant(metric),
    $behaviors: [hideEmptyPreviews(metric)],
    $data: new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: 200,
      queries: autoQuery.preview.queries,
    }),
    body: vizPanel,
  });
}

function getCardPanelFor(metric: string) {
  return PanelBuilders.text()
    .setTitle(metric)
    .setHeaderActions(new SelectMetricAction({ metric, title: 'Select' }))
    .setOption('content', '')
    .build();
}

// Computes the Levenshtein distance between two strings, twice, once for the first half and once for the whole string.
function sortRelatedMetrics(metricList: VariableValueOption[], metric: string) {
  return metricList.sort((a, b) => {
    const aValue = String(a.value);
    const aSplit = aValue.split('_');
    const aHalf = aSplit.slice(0, aSplit.length / 2).join('_');

    const bValue = String(b.value);
    const bSplit = bValue.split('_');
    const bHalf = bSplit.slice(0, bSplit.length / 2).join('_');

    return (
      (leven(aHalf, metric!) || 0 + (leven(aValue, metric!) || 0)) -
      (leven(bHalf, metric!) || 0 + (leven(bValue, metric!) || 0))
    );
  });
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
