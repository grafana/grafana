import { ReactNode } from 'react';

import { SceneObject, useSceneObjectState } from '@grafana/scenes';

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
