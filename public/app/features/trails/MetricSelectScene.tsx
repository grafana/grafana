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
import { getVariablesWithMetricConstant, trailDS, VAR_FILTERS_EXPR, VAR_METRIC_NAMES } from './shared';
import { getColorByIndex, getTrailFor } from './utils';

interface MetricPanel {
  name: string;
  index: number;
  itemRef?: SceneObjectRef<SceneCSSGridItem>;
  isHidden: boolean;
  isPanel?: boolean;
  loaded: boolean;
}

export interface MetricSelectSceneState extends SceneObjectState {
  body: SceneCSSGridLayout;
  showHeading?: boolean;
  searchQuery?: string;
  showPreviews?: boolean;
  hideEmpty?: boolean;
  previewMetricPanels: Record<string, MetricPanel>;
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
      hideEmpty: true,
      previewMetricPanels: {},
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
    return Object.values(this.state.previewMetricPanels).sort((a, b) => {
      if (this.state.hideEmpty) {
        if (a.isHidden) {
          return 1;
        }
        if (b.isHidden) {
          return -1;
        }
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
    const metricsLimit = 100;

    for (let index = 0; index < sortedMetricNames.length; index++) {
      const metric = sortedMetricNames[index];

      const metricName = String(metric.value);
      if (!metricName.match(searchRegex)) {
        continue;
      }

      if (Object.keys(metricsMap).length > metricsLimit) {
        break;
      }

      metricsMap[metricName] = { name: metricName, isHidden: false, index, loaded: false };
    }

    this.setState({ previewMetricPanels: metricsMap });
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

    if (!Object.keys(this.state.previewMetricPanels).length) {
      this.updateMetrics();
    }

    const children: SceneFlexItem[] = [];
    const showPreviews = this.state.showPreviews;
    const previewLimit = 30;
    const cardLimit = 50;

    const metricsList = this.sortedPreviewMetrics();
    for (let index = 0; index < metricsList.length; index++) {
      const metric = metricsList[index];

      if (children.length > cardLimit) {
        break;
      }

      if (showPreviews && children.length < previewLimit) {
        if (metric.itemRef && metric.isPanel) {
          children.push(metric.itemRef.resolve());
          continue;
        }
        const panel = new SceneCSSGridItem({
          $variables: getVariablesWithMetricConstant(metric.name),
          body: getPreviewPanelFor(metric.name, index),
        });
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

  private shouldRebuildLayout = () => {
    return !Object.values(this.state.previewMetricPanels).some((mp) => mp.isPanel && !mp.loaded);
  };

  public hideMetric = (metric: string) => {
    const metricPanel = this.state.previewMetricPanels[metric];
    if (metricPanel) {
      metricPanel.isHidden = true;
      metricPanel.loaded = true;
      this.setState({ previewMetricPanels: { ...this.state.previewMetricPanels, [metric]: metricPanel } });
      if (this.shouldRebuildLayout()) {
        this.buildLayout();
      }
    }
  };

  public metricHasLoaded = (metric: string) => {
    const metricPanel = this.state.previewMetricPanels[metric];
    if (metricPanel) {
      metricPanel.loaded = true;
      this.setState({ previewMetricPanels: { ...this.state.previewMetricPanels, [metric]: metricPanel } });
      if (this.shouldRebuildLayout()) {
        this.buildLayout();
      }
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

  public onToggleHideEmpty = () => {
    this.setState({ hideEmpty: !this.state.hideEmpty });
    this.updateMetrics();
    this.buildLayout();
  };

  public static Component = ({ model }: SceneComponentProps<MetricSelectScene>) => {
    const { showHeading, searchQuery, showPreviews, hideEmpty } = model.useState();
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
          <InlineSwitch
            showLabel={true}
            label="Hide empty panels"
            value={hideEmpty}
            onChange={model.onToggleHideEmpty}
          />
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

  const p = autoQuery.preview
    .vizBuilder(autoQuery.preview)
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
    .setHeaderActions(new SelectMetricAction({ metric, title: 'Select' }))
    .build();

  const data = p.state.$data;
  if (data instanceof SceneQueryRunner) {
    data.addActivationHandler(() => {
      data.subscribeToState((state) => {
        if (state._hasFetchedData) {
          const scene = sceneGraph.getAncestor(p, MetricSelectScene);

          if (!state.data?.series.length) {
            scene.hideMetric(metric);
            return;
          }
          const valueField = state.data?.series.at(0)?.fields.at(1);
          const allNull = !valueField?.values.find((v) => v !== null);
          if (allNull) {
            scene.hideMetric(metric);
            return;
          }
          const allZero = !valueField?.values.find((v) => v !== 0);
          if (allZero) {
            scene.hideMetric(metric);
            return;
          }
          scene.metricHasLoaded(metric);
        }
      });
    });
  }

  return p;
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
