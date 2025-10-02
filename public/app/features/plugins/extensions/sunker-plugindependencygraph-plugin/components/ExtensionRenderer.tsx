/**
 * Extension Renderer Component
 *
 * Renders extension points and exposed components in the dependency graph.
 */

import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import {
  COLOR_DEFAULTS,
  DISPLAY_NAMES,
  LAYOUT_CONSTANTS,
  VISUAL_CONSTANTS,
  getResponsiveComponentWidth,
  getResponsiveGroupSpacing,
} from '../constants';
import { GraphData, PanelOptions } from '../types';

import { PositionInfo } from './GraphLayout';

interface ExtensionRendererProps {
  theme: GrafanaTheme2;
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
  isExposeMode: boolean;
  extensionPointPositions: Map<string, PositionInfo>;
  exposedComponentPositions: Map<string, PositionInfo>;
  selectedExtensionPoint: string | null;
  selectedExposedComponent: string | null;
  onExtensionPointClick: (id: string | null) => void;
  onExposedComponentClick: (id: string | null) => void;
  onExtensionPointRightClick?: (event: React.MouseEvent, extensionPointId: string) => void;
  styles: {
    extensionGroupBox: string;
    extensionPointBox: string;
    extensionPointLabel: string;
    extensionTypeBadge: string;
    definingPluginLabel: string;
    descriptionInlineText: string;
  };
}

export const ExtensionRenderer: React.FC<ExtensionRendererProps> = ({
  theme,
  data,
  options,
  width,
  height,
  isExposeMode,
  extensionPointPositions,
  exposedComponentPositions,
  selectedExtensionPoint,
  selectedExposedComponent,
  onExtensionPointClick,
  onExposedComponentClick,
  onExtensionPointRightClick,
  styles,
}) => {
  if (isExposeMode) {
    return renderExposedComponents();
  } else {
    return renderExtensionPoints();
  }

  function renderExposedComponents() {
    if (!data.exposedComponents) {
      return null;
    }

    // Group exposed components by their providing plugin
    const exposedComponentGroups = new Map<string, string[]>();
    data.exposedComponents.forEach((comp) => {
      if (!exposedComponentGroups.has(comp.providingPlugin)) {
        exposedComponentGroups.set(comp.providingPlugin, []);
      }
      exposedComponentGroups.get(comp.providingPlugin)!.push(comp.id);
    });

    const componentBoxWidth = getResponsiveComponentWidth(width);
    const originalComponentHeight = 60; // Fixed height to match our constants
    let componentBoxHeight = originalComponentHeight;

    if (options.showDescriptions) {
      componentBoxHeight += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
    }

    return (
      <g>
        {Array.from(exposedComponentGroups.entries()).map(([providingPlugin, componentIds], groupIndex) => {
          const firstCompPos = exposedComponentPositions.get(componentIds[0]);
          if (!firstCompPos) {
            return null;
          }

          const groupHeight = firstCompPos.groupHeight;

          return (
            <g key={providingPlugin}>
              {/* Provider group box */}
              <rect
                x={firstCompPos.x - 20}
                y={firstCompPos.groupY}
                width={componentBoxWidth + 40}
                height={groupHeight}
                fill={theme.colors.background.secondary}
                stroke={theme.colors.border.strong}
                strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
                rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
                className={styles.extensionGroupBox}
              />

              {/* Exposed components inside provider box */}
              {componentIds.map((compId) => {
                const compPos = exposedComponentPositions.get(compId);
                if (!compPos) {
                  return null;
                }

                const exposedComponent = data.exposedComponents?.find((comp) => comp.id === compId);
                if (!exposedComponent) {
                  return null;
                }

                return (
                  <g key={compId}>
                    {/* Individual exposed component box */}
                    <rect
                      x={compPos.x}
                      y={compPos.y - originalComponentHeight / 2}
                      width={componentBoxWidth}
                      height={componentBoxHeight}
                      fill={theme.colors.warning.main}
                      stroke={
                        selectedExposedComponent === exposedComponent.id
                          ? theme.colors.primary.border
                          : theme.colors.border.strong
                      }
                      strokeWidth={
                        selectedExposedComponent === exposedComponent.id
                          ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH
                          : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
                      }
                      rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                      className={styles.extensionPointBox}
                      onClick={() =>
                        onExposedComponentClick(
                          selectedExposedComponent === exposedComponent.id ? null : exposedComponent.id
                        )
                      }
                      style={{ cursor: 'pointer' }}
                    />

                    {/* Component title */}
                    <text
                      x={compPos.x + componentBoxWidth / 2}
                      y={compPos.y - 5}
                      textAnchor="middle"
                      className={styles.extensionPointLabel}
                      fill={theme.colors.getContrastText(theme.colors.warning.main)}
                    >
                      {exposedComponent.title || exposedComponent.id}
                    </text>

                    {/* Component ID - second line */}
                    <text
                      x={compPos.x + componentBoxWidth / 2}
                      y={compPos.y + 15}
                      textAnchor="middle"
                      className={styles.extensionTypeBadge}
                      fill={theme.colors.getContrastText(theme.colors.warning.main)}
                    >
                      {exposedComponent.id}
                    </text>

                    {/* Description text underneath component ID */}
                    {options.showDescriptions &&
                      exposedComponent?.description &&
                      exposedComponent.description.trim() !== '' && (
                        <text
                          x={compPos.x + componentBoxWidth / 2}
                          y={compPos.y + 30}
                          textAnchor="middle"
                          className={styles.descriptionInlineText}
                          fill={theme.colors.getContrastText(theme.colors.warning.main)}
                        >
                          {exposedComponent.description}
                        </text>
                      )}
                  </g>
                );
              })}

              {/* Provider plugin name header */}
              <text
                x={firstCompPos.x}
                y={firstCompPos.groupY + 25}
                textAnchor="start"
                className={styles.definingPluginLabel}
                fill={theme.colors.text.primary}
              >
                {getDisplayName(providingPlugin)}
              </text>

              {/* Dotted line separator between provider sections (except for the last one) */}
              {groupIndex < Array.from(exposedComponentGroups.entries()).length - 1 && (
                <line
                  x1={10}
                  y1={firstCompPos.groupY + groupHeight + (getResponsiveGroupSpacing(height) + 30) / 2}
                  x2={width - 10}
                  y2={firstCompPos.groupY + groupHeight + (getResponsiveGroupSpacing(height) + 30) / 2}
                  stroke={theme.colors.border.medium}
                  strokeWidth={1}
                  strokeDasharray="5,5"
                />
              )}
            </g>
          );
        })}
      </g>
    );
  }

  function renderExtensionPoints() {
    if (!data.extensionPoints) {
      return null;
    }

    // Group extension points by their defining plugin
    const extensionPointGroups = new Map<string, string[]>();
    data.extensionPoints.forEach((ep) => {
      if (!extensionPointGroups.has(ep.definingPlugin)) {
        extensionPointGroups.set(ep.definingPlugin, []);
      }
      extensionPointGroups.get(ep.definingPlugin)!.push(ep.id);
    });

    const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
    const originalHeight = options.showDependencyTypes
      ? LAYOUT_CONSTANTS.EXTENSION_BOX_HEIGHT
      : LAYOUT_CONSTANTS.EXTENSION_BOX_HEIGHT_NO_TYPE;
    let extensionBoxHeight = originalHeight;

    if (options.showDescriptions) {
      extensionBoxHeight += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
    }

    return (
      <g>
        {Array.from(extensionPointGroups.entries()).map(([definingPlugin, extensionPointIds]) => {
          const firstEpPos = extensionPointPositions.get(extensionPointIds[0]);
          if (!firstEpPos) {
            return null;
          }

          const groupHeight = firstEpPos.groupHeight;

          return (
            <g key={definingPlugin}>
              {/* Defining plugin group box */}
              <rect
                x={firstEpPos.x - 10}
                y={firstEpPos.groupY}
                width={extensionBoxWidth + 20}
                height={groupHeight}
                fill={theme.colors.background.secondary}
                stroke={theme.colors.border.strong}
                strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
                rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
                className={styles.extensionGroupBox}
              />

              {/* Extension points */}
              {extensionPointIds.map((epId) => {
                const epPos = extensionPointPositions.get(epId);
                if (!epPos) {
                  return null;
                }

                const extensionPoint = data.extensionPoints?.find((ep) => ep.id === epId);
                const extensionType = extensionPoint?.extensionType || 'link';
                const extensionColor = getExtensionColor(extensionType);

                return (
                  <g key={epId}>
                    {/* Extension point box with type-specific color */}
                    <rect
                      x={epPos.x}
                      y={epPos.y - originalHeight / 2}
                      width={extensionBoxWidth}
                      height={extensionBoxHeight}
                      fill={extensionColor}
                      stroke={
                        selectedExtensionPoint === epId ? theme.colors.primary.border : theme.colors.border.strong
                      }
                      strokeWidth={
                        selectedExtensionPoint === epId
                          ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH
                          : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
                      }
                      rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                      className={styles.extensionPointBox}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        // Left-click for context menu
                        onExtensionPointRightClick?.(event, epId);
                      }}
                      style={{ cursor: 'pointer' }}
                    />

                    {/* Invisible overlay to capture all clicks in the extension point area */}
                    <rect
                      x={epPos.x}
                      y={epPos.y - originalHeight / 2}
                      width={extensionBoxWidth}
                      height={extensionBoxHeight}
                      fill="transparent"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        console.log('Left-click detected on extension point:', epId);
                        // Left-click for context menu
                        onExtensionPointRightClick?.(event, epId);
                      }}
                      style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    />

                    {/* Extension point ID - first line */}
                    <text
                      x={epPos.x + extensionBoxWidth / 2}
                      y={options.showDependencyTypes ? epPos.y - 5 : epPos.y + 5}
                      textAnchor="middle"
                      className={styles.extensionPointLabel}
                      fill={theme.colors.getContrastText(extensionColor)}
                      style={{ pointerEvents: 'none' }}
                    >
                      {epId}
                    </text>

                    {/* Extension type - second line in parentheses */}
                    {options.showDependencyTypes && (
                      <g>
                        <text
                          x={epPos.x + extensionBoxWidth / 2}
                          y={epPos.y + 15}
                          textAnchor="middle"
                          className={styles.extensionTypeBadge}
                          fill={theme.colors.getContrastText(extensionColor)}
                          style={{ pointerEvents: 'none' }}
                        >
                          {/* ({extensionType} extension) */}
                        </text>

                        {/* Description text underneath parentheses */}
                        {options.showDescriptions &&
                          extensionPoint?.description &&
                          extensionPoint.description.trim() !== '' && (
                            <text
                              x={epPos.x + extensionBoxWidth / 2}
                              y={epPos.y + 30}
                              textAnchor="middle"
                              className={styles.descriptionInlineText}
                              fill={theme.colors.getContrastText(extensionColor)}
                              style={{ pointerEvents: 'none' }}
                            >
                              {extensionPoint.description}
                            </text>
                          )}
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Defining plugin name header */}
              <text
                x={firstEpPos.x}
                y={firstEpPos.groupY + 22}
                textAnchor="start"
                className={styles.definingPluginLabel}
                fill={theme.colors.text.primary}
              >
                {getDisplayName(definingPlugin)}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  function getExtensionColor(type: string): string {
    switch (type) {
      case 'component':
        return options.componentExtensionColor || COLOR_DEFAULTS.COMPONENT_EXTENSION;
      case 'function':
        return options.functionExtensionColor || COLOR_DEFAULTS.FUNCTION_EXTENSION;
      case 'link':
      default:
        return options.linkExtensionColor || COLOR_DEFAULTS.LINK_EXTENSION;
    }
  }

  function getDisplayName(pluginId: string): string {
    if (pluginId === 'grafana-core') {
      return DISPLAY_NAMES.GRAFANA_CORE;
    }
    return pluginId;
  }
};
