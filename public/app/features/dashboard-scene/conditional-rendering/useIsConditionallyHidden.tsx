import { ReactNode } from 'react';

import { SceneObject } from '@grafana/scenes';

import { ConditionalRendering } from './ConditionalRendering';
import { ConditionalRenderingOverlay } from './ConditionalRenderingOverlay';

export function useIsConditionallyHidden(scene: SceneObject): [boolean, string | undefined, ReactNode | null] {
  const state = scene.useState();

  if (!('conditionalRendering' in state) || !(state.conditionalRendering instanceof ConditionalRendering)) {
    return [false, undefined, null];
  }

  const value = state.conditionalRendering.evaluate() ?? true;

  return [
    !value,
    value ? undefined : 'dashboard-visible-hidden-element',
    value ? null : <ConditionalRenderingOverlay />,
  ];
}
