import { ReactNode } from 'react';

import { SceneObject } from '@grafana/scenes';

import { ConditionalRendering } from './ConditionalRendering';
import { ConditionalRenderingOverlay } from './ConditionalRenderingOverlay';

export function useIsConditionallyHidden(scene: SceneObject): [boolean, string | undefined, ReactNode | null] {
  const state = scene.useState();

  if (!('conditionalRendering' in state) || !(state.conditionalRendering instanceof ConditionalRendering)) {
    return [false, undefined, null];
  }

  const { result } = state.conditionalRendering.useState();

  return [
    !result,
    result ? undefined : 'dashboard-visible-hidden-element',
    result ? null : <ConditionalRenderingOverlay />,
  ];
}
