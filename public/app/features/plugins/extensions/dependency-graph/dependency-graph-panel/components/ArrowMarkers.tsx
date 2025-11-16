/**
 * Arrow Markers Component
 *
 * Defines SVG arrow markers for dependency links.
 */

import { GrafanaTheme2 } from '@grafana/data';

import { VISUAL_CONSTANTS } from '../constants';

interface ArrowMarkersProps {
  theme: GrafanaTheme2;
}

export function ArrowMarkers({ theme }: ArrowMarkersProps) {
  return (
    <defs>
      {/* Default arrow marker */}
      <marker
        id="arrowhead"
        markerWidth={VISUAL_CONSTANTS.ARROW_WIDTH}
        markerHeight={VISUAL_CONSTANTS.ARROW_HEIGHT}
        refX={VISUAL_CONSTANTS.ARROW_REF_X}
        refY={VISUAL_CONSTANTS.ARROW_REF_Y}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon
          points={`0 0, ${VISUAL_CONSTANTS.ARROW_WIDTH} ${VISUAL_CONSTANTS.ARROW_REF_Y}, 0 ${VISUAL_CONSTANTS.ARROW_HEIGHT}`}
          fill={theme.colors.primary.main}
          stroke={theme.colors.primary.main}
          strokeWidth="0.5"
        />
      </marker>

      {/* Highlighted arrow marker */}
      <marker
        id="arrowhead-highlighted"
        markerWidth={VISUAL_CONSTANTS.ARROW_WIDTH}
        markerHeight={VISUAL_CONSTANTS.ARROW_HEIGHT}
        refX={VISUAL_CONSTANTS.ARROW_REF_X}
        refY={VISUAL_CONSTANTS.ARROW_REF_Y}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon
          points={`0 0, ${VISUAL_CONSTANTS.ARROW_WIDTH} ${VISUAL_CONSTANTS.ARROW_REF_Y}, 0 ${VISUAL_CONSTANTS.ARROW_HEIGHT}`}
          fill={theme.colors.success.main}
          stroke={theme.colors.success.main}
          strokeWidth="0.5"
        />
      </marker>
    </defs>
  );
}
