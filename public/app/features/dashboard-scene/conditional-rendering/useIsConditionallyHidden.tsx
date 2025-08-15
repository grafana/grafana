import { ReactNode } from 'react';

import { SceneObject } from '@grafana/scenes';

import { ConditionalRendering } from './ConditionalRendering';
import { ConditionalRenderingOverlay } from './ConditionalRenderingOverlay';

function protectedUseIsConditionallyHidden(
  conditionalRendering: ConditionalRendering
): [boolean, string | undefined, ReactNode | null, boolean] {
  const { result, renderHidden } = conditionalRendering.useState();

  return [
    !result,
    result ? undefined : 'dashboard-visible-hidden-element',
    result ? null : <ConditionalRenderingOverlay />,
    renderHidden,
  ];
}

export function useIsConditionallyHidden(scene: SceneObject): [boolean, string | undefined, ReactNode | null, boolean] {
  const state = scene.useState();

  if (!('conditionalRendering' in state) || !(state.conditionalRendering instanceof ConditionalRendering)) {
    return [false, undefined, null, true];
  }

  return protectedUseIsConditionallyHidden(state.conditionalRendering);
}
