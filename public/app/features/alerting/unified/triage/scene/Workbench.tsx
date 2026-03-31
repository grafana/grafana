import { useEffect, useRef, useState, useTransition } from 'react';

import { type DataFrame } from '@grafana/data';
import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectState,
  sceneGraph,
  sceneUtils,
} from '@grafana/scenes';
import { useQueryRunner, useTimeRange, useVariableValues } from '@grafana/scenes-react';

import { Workbench } from '../Workbench';
import { DEFAULT_FIELDS, VARIABLES } from '../constants';

import { TRIAGE_TIME_MODE_KEY, TriageTimeModeControl } from './TriageTimeModeControl';
import { convertToWorkbenchRows } from './dataTransform';
import { getLiveWorkbenchQueries, getWorkbenchQueries } from './queries';
import { convertTimeRangeToDomain, useQueryFilter } from './utils';

const LIVE_RETENTION_MS = 15 * 60 * 1000;

interface RetainedFrameRow {
  values: Record<string, unknown>;
  lastActiveAt: number;
}

function buildCompositeKey(frame: DataFrame, rowIndex: number, identityFields: Set<string>): string {
  const parts: string[] = [];
  for (const field of frame.fields) {
    if (identityFields.has(field.name)) {
      parts.push(String(field.values[rowIndex] ?? ''));
    }
  }
  return parts.join('\x00');
}

function injectRetainedRows(frame: DataFrame, retainedRows: RetainedFrameRow[]): DataFrame {
  if (retainedRows.length === 0) {
    return frame;
  }

  return {
    ...frame,
    length: frame.length + retainedRows.length,
    fields: frame.fields.map((field) => ({
      ...field,
      values: [...field.values, ...retainedRows.map((r) => r.values[field.name])],
    })),
  };
}

export class WorkbenchSceneObject extends SceneObjectBase<SceneObjectState> {
  public static Component = WorkbenchRenderer;
}

function useTriageMode(model: WorkbenchSceneObject): 'live' | 'history' | undefined {
  const modeControl = sceneGraph.findObject(model, (obj) => obj.state.key === TRIAGE_TIME_MODE_KEY);
  const state = modeControl instanceof TriageTimeModeControl ? modeControl.useState() : undefined;
  return state?.mode;
}

export function WorkbenchRenderer({ model }: SceneComponentProps<WorkbenchSceneObject>) {
  const [timeRange] = useTimeRange();
  const domain = convertTimeRangeToDomain(timeRange);
  const triageMode = useTriageMode(model);

  const [groupByKeys = []] = useVariableValues<string>(VARIABLES.groupBy);
  const countBy = [...DEFAULT_FIELDS, ...groupByKeys].join(',');
  const queryFilter = useQueryFilter();

  const queries =
    triageMode === 'live' ? getLiveWorkbenchQueries(countBy, queryFilter) : getWorkbenchQueries(countBy, queryFilter);

  const runner = useQueryRunner({ queries });
  const { data } = runner.useState();

  const [rows, setRows] = useState<ReturnType<typeof convertToWorkbenchRows>>([]);
  const [isPending, startTransition] = useTransition();
  const hasFiltersApplied = queryFilter.length > 0;

  const triageModeRef = useRef(triageMode);
  triageModeRef.current = triageMode;

  const retainedMapRef = useRef<Map<string, RetainedFrameRow>>(new Map());

  const groupByKey = groupByKeys.join(',');
  useEffect(() => {
    retainedMapRef.current.clear();
  }, [triageMode, queryFilter, groupByKey]);

  // convertToWorkbenchRows is expensive when processing large datasets.
  // We use runner.subscribeToState() instead of runner.useState() to transform data
  // only when it actually changes. Using useState() triggers 2-3 unnecessary calls
  // to convertToWorkbenchRows per update, even when wrapped in useMemo.
  useEffect(() => {
    const transformData = (newState: typeof runner.state) => {
      if (newState.data?.state !== 'Done' || !newState.data?.series) {
        return;
      }

      let currentGroupByKeys: string[] = [];
      const groupByVariable = sceneGraph.lookupVariable(VARIABLES.groupBy, runner);

      if (groupByVariable && sceneUtils.isGroupByVariable(groupByVariable)) {
        const value = groupByVariable.getValue();
        if (Array.isArray(value)) {
          currentGroupByKeys = value.map((value) => String(value));
        }
      }

      const { series } = newState.data;
      let badgeFrame = findBadgeFrame(series);

      if (triageModeRef.current === 'live' && badgeFrame) {
        const identityFields = new Set([...DEFAULT_FIELDS, ...currentGroupByKeys]);
        badgeFrame = applyRetention(badgeFrame, retainedMapRef.current, identityFields);
      }

      startTransition(() => {
        setRows(convertToWorkbenchRows(badgeFrame ? [badgeFrame] : series, currentGroupByKeys));
      });
    };

    const subscription = runner.subscribeToState((newState, prevState) => {
      if (newState.data !== prevState.data) {
        transformData(newState);
      }
    });

    return () => subscription.unsubscribe();
  }, [runner]);

  const isDataLoading = data?.state === 'Loading' || data?.state === 'NotStarted' || data === undefined;
  const isInitialLoading = (isDataLoading || isPending) && rows.length === 0;
  const isRefreshing = isDataLoading && rows.length > 0;

  return (
    <Workbench
      data={rows}
      domain={domain}
      queryRunner={runner}
      groupBy={groupByKeys}
      isInitialLoading={isInitialLoading}
      isRefreshing={isRefreshing}
      hasActiveFilters={hasFiltersApplied}
      isLiveMode={triageMode === 'live'}
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

/**
 * Updates the retention map with fresh data and returns the badge frame
 * augmented with retained-but-inactive rows (grace period <= 15 min).
 */
function applyRetention(
  badgeFrame: DataFrame,
  retainedMap: Map<string, RetainedFrameRow>,
  identityFields: Set<string>
): DataFrame {
  const now = Date.now();
  const freshKeys = new Set<string>();

  for (let i = 0; i < badgeFrame.length; i++) {
    const key = buildCompositeKey(badgeFrame, i, identityFields);
    freshKeys.add(key);

    const values: Record<string, unknown> = {};
    for (const field of badgeFrame.fields) {
      values[field.name] = field.values[i];
    }
    retainedMap.set(key, { values, lastActiveAt: now });
  }

  const rowsToInject: RetainedFrameRow[] = [];
  for (const [key, entry] of retainedMap) {
    if (freshKeys.has(key)) {
      continue;
    }
    if (now - entry.lastActiveAt >= LIVE_RETENTION_MS) {
      retainedMap.delete(key);
    } else {
      rowsToInject.push(entry);
    }
  }

  return injectRetainedRows(badgeFrame, rowsToInject);
}
