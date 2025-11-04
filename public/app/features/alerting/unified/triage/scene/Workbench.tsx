import { useEffect, useState, useTransition } from 'react';

import { SceneObjectBase, SceneObjectState, sceneGraph, sceneUtils } from '@grafana/scenes';
import { useQueryRunner, useTimeRange, useVariableValues } from '@grafana/scenes-react';

import { Workbench } from '../Workbench';
import { DEFAULT_FIELDS, METRIC_NAME, VARIABLES } from '../constants';

import { convertToWorkbenchRows } from './dataTransform';
import { convertTimeRangeToDomain, getDataQuery, useQueryFilter } from './utils';

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
    queries: [
      getDataQuery(`count by (${countBy}) (${METRIC_NAME}{${queryFilter}})`, {
        format: 'table',
      }),
    ],
  });
  const { data } = runner.useState();

  const [rows, setRows] = useState<ReturnType<typeof convertToWorkbenchRows>>([]);
  const [isPending, startTransition] = useTransition();

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
      // Use transition for non-blocking update
      startTransition(() => {
        setRows(convertToWorkbenchRows(series, currentGroupByKeys));
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

  return <Workbench data={rows} domain={domain} queryRunner={runner} isLoading={isLoading} />;
}
