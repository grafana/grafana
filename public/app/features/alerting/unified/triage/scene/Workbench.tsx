import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
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
  const rows = data ? convertToWorkbenchRows(data, groupByKeys) : [];

  return <Workbench data={rows} domain={domain} queryRunner={runner} />;
}
