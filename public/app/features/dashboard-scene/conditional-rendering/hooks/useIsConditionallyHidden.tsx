import { ReactNode } from 'react';

import { useSceneObjectState } from '@grafana/scenes';

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
  conditionalRendering: ConditionalRenderingGroup = getPlaceholderConditionalRendering()
): [boolean, string | undefined, ReactNode | null, boolean] {
  const { result, renderHidden } = useSceneObjectState(conditionalRendering, {
    shouldActivateOrKeepAlive: true,
  });

  return [
    !result,
    result ? undefined : 'dashboard-visible-hidden-element',
    result ? null : <ConditionalRenderingOverlay />,
    renderHidden,
  ];
}
