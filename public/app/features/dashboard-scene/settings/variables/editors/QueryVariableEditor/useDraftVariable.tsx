import { useRef } from 'react';

import { QueryVariable, sceneGraph, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { collectAncestorSceneVariables } from '../../../../utils/collectAncestorSceneVariables';

export function useDraftVariable(variable: QueryVariable) {
  const draftVariableRef = useRef<QueryVariable>();

  if (!draftVariableRef.current) {
    const timeRange = sceneGraph.getTimeRange(variable);
    // All ancestor variable sets are collected (not just the nearest one) so a
    // section-scoped variable can still resolve dashboard-level references;
    // inner scope wins on duplicate names, matching lookupVariable semantics.
    const variables = collectAncestorSceneVariables(variable);

    draftVariableRef.current = new QueryVariable({
      ...variable.state,
      $timeRange: new SceneTimeRange(timeRange.state),
      // The edited variable is excluded from the draft's scope so a self-reference
      // resolves to nothing instead of a stale clone of itself.
      $variables: new SceneVariableSet({
        variables: variables.filter((v) => v !== variable).map((v) => v.clone()),
      }),
    });
  }

  const initialStateRef = useRef({ ...variable.state });

  return { draftVariable: draftVariableRef.current, initialState: initialStateRef.current };
}
