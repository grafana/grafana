import { flip, Placement, shift } from '@floating-ui/react';

export const BOUNDARY_ELEMENT_ID = 'floating-boundary';

export function getPositioningMiddleware(placement?: Placement) {
  const middleware = [];

  const flipMiddleware = flip({
    // Ensure we flip to the perpendicular axis if it doesn't fit
    // on narrow viewports.
    crossAxis: 'alignment',
    fallbackAxisSideDirection: 'end',
    boundary: document.getElementById(BOUNDARY_ELEMENT_ID) ?? undefined,
  });
  const shiftMiddleware = shift();

  // Prioritize flip over shift for edge-aligned placements only.
  if (placement?.includes('-')) {
    middleware.push(flipMiddleware, shiftMiddleware);
  } else {
    middleware.push(shiftMiddleware, flipMiddleware);
  }

  return middleware;
}
