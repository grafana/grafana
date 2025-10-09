import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';

import { LAYOUT_CONSTANTS, TYPOGRAPHY_CONSTANTS, VISUAL_CONSTANTS } from '../constants';
import { GraphData, PanelOptions } from '../types';
import { getDisplayName } from '../utils/helpers/extensionUtils';

import { PositionInfo } from './GraphLayout';

interface ExposedComponentsRendererProps {
  theme: GrafanaTheme2;
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
  exposedComponentPositions: Map<string, PositionInfo>;
  selectedExposedComponent: string | null;
  onExposedComponentClick: (id: string | null) => void;
  styles: {
    exposedComponentBox: { toString(): string };
    exposedComponentLabel: { toString(): string };
    exposedComponentDescription: { toString(): string };
    exposedComponentVersion: { toString(): string };
    exposedComponentProvider: { toString(): string };
  };
}

/**
 * Component for rendering exposed components in expose mode
 */
export function ExposedComponentsRenderer({
  theme,
  data,
  options,
  width,
  height,
  exposedComponentPositions,
  selectedExposedComponent,
  onExposedComponentClick,
  styles,
}: ExposedComponentsRendererProps): JSX.Element {
  return (
    <>
      {Array.from(exposedComponentPositions.entries()).map(([componentId, position]) => {
        const exposedComponent = data.exposedComponents?.find((comp) => comp.id === componentId);
        if (!exposedComponent) {
          return null;
        }

        const isSelected = selectedExposedComponent === componentId;
        const strokeColor = isSelected ? theme.colors.primary.border : theme.colors.border.medium;
        const strokeWidth = isSelected ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH;

        return (
          <g key={componentId}>
            {/* Exposed Component Box */}
            <rect
              x={position.x}
              y={position.y}
              width={LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH}
              height={LAYOUT_CONSTANTS.EXTENSION_BOX_HEIGHT}
              rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
              fill={theme.colors.background.secondary}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              className={styles.exposedComponentBox.toString()}
              onClick={() => onExposedComponentClick(componentId)}
              style={{ cursor: 'pointer' }}
            />

            {/* Exposed Component Label */}
            <text
              x={position.x + 10}
              y={position.y + 20}
              fontSize={TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}
              fill={theme.colors.text.primary}
              className={styles.exposedComponentLabel.toString()}
            >
              {exposedComponent.title || exposedComponent.id}
            </text>

            {/* Exposed Component Description */}
            {exposedComponent.description && (
              <text
                x={position.x + 10}
                y={position.y + 35}
                fontSize={TYPOGRAPHY_CONSTANTS.DESCRIPTION_SIZE}
                fill={theme.colors.text.secondary}
                className={styles.exposedComponentDescription.toString()}
              >
                {exposedComponent.description}
              </text>
            )}

            {/* Exposed Component Provider */}
            <text
              x={position.x + 10}
              y={position.y + LAYOUT_CONSTANTS.EXTENSION_BOX_HEIGHT - 5}
              fontSize={TYPOGRAPHY_CONSTANTS.TYPE_BADGE_SIZE}
              fill={theme.colors.text.secondary}
              className={styles.exposedComponentProvider.toString()}
            >
              <Trans
                i18nKey="extensions.dependency-graph.provided-by"
                defaults="Provided by {{provider}}"
                values={{ provider: getDisplayName(exposedComponent.providingPlugin) }}
              />
            </text>
          </g>
        );
      })}
    </>
  );
}
