import { ReactNode } from 'react';

import { SceneObject, sceneGraph, useSceneObjectState } from '@grafana/scenes';

import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';

import { ConditionalRenderingOverlay } from './ConditionalRenderingOverlay';

let placeholderConditionalRendering: ConditionalRenderingGroup | undefined;
function getPlaceholderConditionalRendering(): ConditionalRenderingGroup {
  if (!placeholderConditionalRendering) {
    placeholderConditionalRendering = ConditionalRenderingGroup.createEmpty();
  }
  return placeholderConditionalRendering;
}

export function useIsConditionallyHidden(scene: SceneObject): [boolean, string | undefined, ReactNode | null, boolean] {
  const conditionalRenderingToRender =
    'conditionalRendering' in scene.state && scene.state.conditionalRendering instanceof ConditionalRenderingGroup
      ? scene.state.conditionalRendering
      : getPlaceholderConditionalRendering();

  const { result, renderHidden } = useSceneObjectState(conditionalRenderingToRender, {
    shouldActivateOrKeepAlive: true,
  });

  return [
    !result,
    result ? undefined : 'dashboard-visible-hidden-element',
    result ? null : <ConditionalRenderingOverlay />,
    renderHidden,
  ];
}

export function useIsConditionallyHiddenForTarget(
  owner: SceneObject,
  target: SceneObject
): [boolean, string | undefined, ReactNode | null, boolean] {
  const group =
    'conditionalRendering' in owner.state && owner.state.conditionalRendering instanceof ConditionalRenderingGroup
      ? owner.state.conditionalRendering
      : getPlaceholderConditionalRendering();

  const { renderHidden } = useSceneObjectState(group, {
    shouldActivateOrKeepAlive: true,
  });

  // Subscribe to relevant target inputs so this hook re-renders on changes
  sceneGraph.getVariables(target).useState();
  sceneGraph.getTimeRange(target).useState();
  sceneGraph.getData(target)?.useState();

  const result = group.evaluate(target);

  return [
    !(result ?? true),
    result ? undefined : 'dashboard-visible-hidden-element',
    result ? null : <ConditionalRenderingOverlay />,
    renderHidden,
  ];
}
