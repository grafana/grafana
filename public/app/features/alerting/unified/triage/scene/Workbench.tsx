import { useEffect, useState, useTransition } from 'react';

import { DataFrame } from '@grafana/data';
import { SceneObjectBase, SceneObjectState, sceneGraph, sceneUtils } from '@grafana/scenes';
import { useQueryRunner, useTimeRange, useVariableValues } from '@grafana/scenes-react';

import { Workbench } from '../Workbench';
import { DEFAULT_FIELDS, VARIABLES } from '../constants';

import { convertToWorkbenchRows } from './dataTransform';
import { getWorkbenchQueries } from './queries';
import { convertTimeRangeToDomain, useQueryFilter } from './utils';

export class WorkbenchSceneObject extends SceneObjectBase<SceneObjectState> {
  public static Component = WorkbenchRenderer;
}

export function WorkbenchRenderer() {
  const [timeRange] = useTimeRange();
  const domain = convertTimeRangeToDomain(timeRange);

  const [groupByKeys = []] = useVariableValues<string>(VARIABLES.groupBy);
  const countBy = [...DEFAULT_FIELDS, ...groupByKeys].join(',');
  const queryFilter = useQueryFilter();

  const runner = useQueryRunner({
    queries: getWorkbenchQueries(countBy, queryFilter),
  });
  const { data } = runner.useState();

  const [rows, setRows] = useState<ReturnType<typeof convertToWorkbenchRows>>([]);
  const [isPending, startTransition] = useTransition();
  const hasFiltersApplied = queryFilter.length > 0;

  // convertToWorkbenchRows is expensive when processing large datasets.
  // We use runner.subscribeToState() instead of runner.useState() to transform data
  // only when it actually changes. Using useState() triggers 2-3 unnecessary calls
  // to convertToWorkbenchRows per update, even when wrapped in useMemo.
  // Subscribe to runner state changes and transform data
  useEffect(() => {
    const transformData = (newState: typeof runner.state) => {
      if (newState.data?.state !== 'Done' || !newState.data?.series) {
        return;
      }

      // Get the groupBy from the scene directly to avoid having groupByVariable in the dependency array
      let currentGroupByKeys: string[] = [];
      const groupByVariable = sceneGraph.lookupVariable(VARIABLES.groupBy, runner);

      if (groupByVariable && sceneUtils.isGroupByVariable(groupByVariable)) {
        const value = groupByVariable.getValue();
        if (Array.isArray(value)) {
          currentGroupByKeys = value.map((value) => String(value));
        }
      }

      const { series } = newState.data;
      // Use the badge frame (instant query B) for tree building and instance counts.
      // The badge query deduplicates instances at the PromQL level.
      const badgeFrame = findBadgeFrame(series);

      // Use transition for non-blocking update
      startTransition(() => {
        setRows(convertToWorkbenchRows(badgeFrame ? [badgeFrame] : series, currentGroupByKeys));
      });
    };

    // Subscribe to state changes
    const subscription = runner.subscribeToState((newState, prevState) => {
      // Only transform if data actually changed
      if (newState.data !== prevState.data) {
        transformData(newState);
      }
    });

    return () => subscription.unsubscribe();
  }, [runner]);

  const isDataLoading = data?.state === 'Loading';
  const isLoading = isDataLoading || isPending;

  return (
    <Workbench
      data={rows}
      domain={domain}
      queryRunner={runner}
      groupBy={groupByKeys}
      isLoading={isLoading}
      hasActiveFilters={hasFiltersApplied}
    />
  );
}

/**
 * Finds the badge frame (instant query B) from the series.
 * When multiple queries share a query runner, the Prometheus plugin renames
 * the Value field to "Value #<refId>". We check both the frame's refId and
 * the field naming convention.
 */
function findBadgeFrame(series: DataFrame[]): DataFrame | undefined {
  return series.find((frame) => frame.refId === 'B' || frame.fields.some((f) => f.name === 'Value #B'));
}
