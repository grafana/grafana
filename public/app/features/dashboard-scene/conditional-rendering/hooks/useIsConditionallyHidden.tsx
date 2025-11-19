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

export function useIsConditionallyHidden(
  scene: SceneObject,
  itemIdx?: number
): [boolean, string | undefined, ReactNode | null, boolean] {
  let conditionalRenderingToRender = getPlaceholderConditionalRendering();

  if (itemIdx !== undefined) {
    if (
      'repeatedConditionalRendering' in scene.state &&
      Array.isArray(scene.state.repeatedConditionalRendering) &&
      scene.state.repeatedConditionalRendering[itemIdx] &&
      scene.state.repeatedConditionalRendering[itemIdx] instanceof ConditionalRenderingGroup
    ) {
      conditionalRenderingToRender = scene.state.repeatedConditionalRendering[itemIdx];
    }
  } else {
    if (
      'conditionalRendering' in scene.state &&
      scene.state.conditionalRendering instanceof ConditionalRenderingGroup
    ) {
      conditionalRenderingToRender = scene.state.conditionalRendering;
    }
  }

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
