import { css } from '@emotion/css';
import { useState } from 'react';
import { useAsync } from 'react-use';

import { AdHocVariableFilter, GrafanaTheme2, RawTimeRange } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { isFetchError } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizConfigBuilders,
} from '@grafana/scenes';
import { useQueryRunner, VizGridLayout, VizPanel } from '@grafana/scenes-react';
import { Field, Icon, Input, useStyles2 } from '@grafana/ui';
import { getSelectedScopes } from 'app/features/scopes';

import { getAutoQueriesForMetric } from '../AutomaticMetricQueries/AutoQueryEngine';
import { DataTrail } from '../DataTrail';
import { MDP_METRIC_PREVIEW, trailDS, VAR_DATASOURCE_EXPR, VAR_FILTERS } from '../shared';
import { getColorByIndex, getFilters, getTrailFor } from '../utils';

import { AddToExplorationButton } from './AddToExplorationsButton';
import { SelectMetricAction } from './SelectMetricAction';
import { getMetricNames } from './api';
import { convertPreviewQueriesToIgnoreUsage } from './previewPanel';
import { createJSRegExpFromSearchTerms, createPromRegExp } from './util';

// interface MetricPanel {
//   name: string;
//   index: number;
//   itemRef?: SceneObjectRef<SceneCSSGridItem>;
//   isEmpty?: boolean;
//   isPanel?: boolean;
//   loaded?: boolean;
// }

export interface MetricSelectSceneState2 extends SceneObjectState {
  // body: SceneFlexLayout | SceneCSSGridLayout;
  // rootGroup?: Node;
  // metricPrefix?: string;
  // metricNames?: string[];
  // metricNamesLoading?: boolean;
  // metricNamesError?: string;
  // metricNamesWarning?: string;
}

const ROW_PREVIEW_HEIGHT = '175px';
const ROW_CARD_HEIGHT = '64px';
const METRIC_PREFIX_ALL = 'all';

const MAX_METRIC_NAMES = 20000;

const viewByTooltip =
  'View by the metric prefix. A metric prefix is a single word at the beginning of the metric name, relevant to the domain the metric belongs to.';

export class MetricSelectSceneReact extends SceneObjectBase<MetricSelectSceneState2> {
  constructor(state: Partial<MetricSelectSceneState2>) {
    super({
      ...state,
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricSelectSceneReact>) => {
    //const {  } =  model.useState();
    const trail = getTrailFor(model);
    const { metricSearch } = trail.useState();
    const styles = useStyles2(getStyles);
    const { metricNames, metricNamesLoading } = useSearchMetricNames(trail);

    let metricNamesFiltered = metricNames;
    if (metricNames && metricNames.length > 25) {
      metricNamesFiltered = metricNames.slice(0, 2);
    }

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Field label={'Search metrics'} className={styles.searchField}>
            <Input
              placeholder="Search metrics"
              prefix={<Icon name={'search'} />}
              value={metricSearch}
              //onChange={model.onSearchQueryChange}
              //suffix={metricNamesWarningIcon}
            />
          </Field>
          {/* <Field
            label={
              <div className={styles.displayOptionTooltip}>
                <Trans i18nKey="explore-metrics.viewBy">View by</Trans>
                <IconButton name={'info-circle'} size="sm" variant={'secondary'} tooltip={viewByTooltip} />
              </div>
            }
            className={styles.displayOption}
          >
            <Select
              value={metricPrefix}
              onChange={model.onPrefixFilterChange}
              onOpenMenu={() => model.reportPrefixFilterInteraction(true)}
              onCloseMenu={() => model.reportPrefixFilterInteraction(false)}
              options={[
                {
                  label: 'All metric names',
                  value: METRIC_PREFIX_ALL,
                },
                ...Array.from(rootGroup?.groups.keys() ?? []).map((g) => ({ label: `${g}_`, value: g })),
              ]}
            />
          </Field> */}
        </div>
        {/* {metricNamesError && (
          <Alert title="Unable to retrieve metric names" severity="error">
            <div>We are unable to connect to your data source. Double check your data source URL and credentials.</div>
            <div>({metricNamesError})</div>
          </Alert>
        )}
        {metricNamesWarning && !warningDismissed && (
          <Alert
            title="Unable to retrieve all metric names"
            severity="warning"
            onSubmit={dismissWarning}
            onRemove={dismissWarning}
          >
            <div>{metricNamesWarning}</div>
          </Alert>
        )} */}
        {metricNamesLoading && <div>Loading metric names...</div>}
        <VizGridLayout>
          {metricNamesFiltered?.map((metric, index) => (
            <MetricSelectPanel metric={metric} selectScene={model} index={index} key={metric} />
            // <div key={metric}>{metric}</div>
          ))}
        </VizGridLayout>
      </div>
    );
  };
}

interface MetricSelectPanelProps {
  metric: string;
  selectScene: MetricSelectSceneReact;
  index: number;
}

function MetricSelectPanel({ metric, selectScene, index }: MetricSelectPanelProps) {
  const autoQuery = getAutoQueriesForMetric(metric);
  const filters = getFilters(selectScene);
  const currentFilterCount = filters?.length || 0;

  const queries = autoQuery.preview.queries.map((query) =>
    convertPreviewQueriesToIgnoreUsage(query, currentFilterCount)
  );

  // Instead of having to wrap each viz in a nested variable context I think this is simpler and faster
  // This is a bit hacky and should be replaced a bit more robust implementation
  queries.forEach((query) => {
    query.expr = query.expr?.replace('${metric}', metric);
    query.legendFormat = query.legendFormat?.replace('${metric}', metric);
  });

  const dataProvider = useQueryRunner({
    datasource: trailDS,
    maxDataPoints: MDP_METRIC_PREVIEW,
    queries,
    cacheKey: [metric],
  });

  const graph = VizConfigBuilders.timeseries()
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
    .build();

  // TODO description
  // TODO use viz from auto queries
  // TODO header actions

  return <VizPanel dataProvider={dataProvider} title={metric} viz={graph} />;
}

interface UseMetricNamesHookResponse {
  metricNames?: string[];
  metricNamesLoading?: boolean;
  metricNamesError?: string;
  metricNamesWarning?: string;
}

function useSearchMetricNames(trail: DataTrail): UseMetricNamesHookResponse {
  const timeRange: RawTimeRange | undefined = trail.state.$timeRange?.state;
  const [state, setState] = useState<UseMetricNamesHookResponse>({ metricNamesLoading: true });

  if (!timeRange) {
    return {};
  }

  const filters: AdHocVariableFilter[] = [];

  const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, trail);
  const adhocFilters = filtersVar instanceof AdHocFiltersVariable ? (filtersVar?.state.filters ?? []) : [];
  if (adhocFilters.length > 0) {
    filters.push(...adhocFilters);
  }

  const metricSearchRegex = createPromRegExp(trail.state.metricSearch);
  if (metricSearchRegex) {
    filters.push({
      key: '__name__',
      operator: '=~',
      value: metricSearchRegex,
    });
  }

  const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);

  useAsync(async () => {
    try {
      const jobsList = trail.state.useOtelExperience ? (trail.state.otelTargets?.jobs ?? []) : [];
      const instancesList = trail.state.useOtelExperience ? (trail.state.otelTargets?.instances ?? []) : [];

      const response = await getMetricNames(
        datasourceUid,
        timeRange,
        getSelectedScopes(),
        filters,
        jobsList,
        instancesList,
        MAX_METRIC_NAMES
      );

      const searchRegex = createJSRegExpFromSearchTerms(getMetricSearch(trail));
      let metricNames = searchRegex
        ? response.data.filter((metric) => !searchRegex || searchRegex.test(metric))
        : response.data;

      // use this to generate groups for metric prefix
      //const filteredMetricNames = metricNames;

      // filter the remaining metrics with the metric prefix
      const metricPrefix = ''; // trail.state.metricPrefix;
      if (metricPrefix && metricPrefix !== 'all') {
        const prefixRegex = new RegExp(`(^${metricPrefix}.*)`, 'igy');
        metricNames = metricNames.filter((metric) => !prefixRegex || prefixRegex.test(metric));
      }

      let metricNamesWarning = response.limitReached
        ? `This feature will only return up to ${MAX_METRIC_NAMES} metric names for performance reasons. ` +
          `This limit is being exceeded for the current data source. ` +
          `Add search terms or label filters to narrow down the number of metric names returned.`
        : undefined;

      // if there are no otel targets for otel resources, there will be no labels
      if (trail.state.useOtelExperience && (jobsList.length === 0 || instancesList.length === 0)) {
        metricNames = [];
        metricNamesWarning = undefined;
      }

      if (response.missingOtelTargets) {
        metricNamesWarning = `${metricNamesWarning ?? ''} The list of metrics is not complete. Select more OTel resource attributes to see a full list of metrics.`;
      }

      setState({
        metricNames,
        metricNamesLoading: false,
        metricNamesWarning,
        metricNamesError: response.error,
      });
    } catch (err: unknown) {
      let error = 'Unknown error';
      if (isFetchError(err)) {
        if (err.cancelled) {
          error = 'Request cancelled';
        } else if (err.statusText) {
          error = err.statusText;
        }
      }

      setState({ metricNames: undefined, metricNamesLoading: false, metricNamesError: error });
    }
  }, [datasourceUid, trail]);

  return state;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    headingWrapper: css({
      marginBottom: theme.spacing(0.5),
    }),
    header: css({
      flexGrow: 0,
      display: 'flex',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(2),
      alignItems: 'flex-end',
    }),
    searchField: css({
      flexGrow: 1,
      marginBottom: 0,
    }),
    metricTabGroup: css({
      marginBottom: theme.spacing(2),
    }),
    displayOption: css({
      flexGrow: 0,
      marginBottom: 0,
      minWidth: '184px',
    }),
    displayOptionTooltip: css({
      display: 'flex',
      gap: theme.spacing(1),
    }),
    warningIcon: css({
      color: theme.colors.warning.main,
    }),
  };
}

function getMetricSearch(scene: SceneObject) {
  const trail = getTrailFor(scene);
  return trail.state.metricSearch || '';
}
