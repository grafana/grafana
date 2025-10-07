/**
 * Extension Renderer Component
 *
 * Renders extension points and exposed components in the dependency graph.
 */

import { SerializedStyles } from '@emotion/react';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';

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
  isExtensionPointMode: boolean;
  extensionPointPositions: Map<string, PositionInfo>;
  exposedComponentPositions: Map<string, PositionInfo>;
  extensionPositions: Map<string, PositionInfo>;
  extensionPointModePositions: Map<string, PositionInfo>;
  selectedExposedComponent: string | null;
  onExposedComponentClick: (id: string | null) => void;
  styles: {
    extensionGroupBox: SerializedStyles;
    extensionPointBox: SerializedStyles;
    extensionPointLabel: SerializedStyles;
    extensionTypeBadge: SerializedStyles;
    definingPluginLabel: SerializedStyles;
    descriptionInlineText: SerializedStyles;
  };
}

export const ExtensionRenderer: React.FC<ExtensionRendererProps> = ({
  theme,
  data,
  options,
  width,
  height,
  isExposeMode,
  isExtensionPointMode,
  extensionPointPositions,
  exposedComponentPositions,
  extensionPositions,
  extensionPointModePositions,
  selectedExposedComponent,
  onExposedComponentClick,
  styles,
}) => {
  if (isExposeMode) {
    return renderExposedComponents();
  } else if (isExtensionPointMode) {
    return renderExtensionPointMode();
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
                      fill={theme.colors.getContrastText(theme.colors.warning.main)}
                    >
                      {exposedComponent.title || exposedComponent.id}
                    </text>

                    {/* Component ID - second line */}
                    <text
                      x={compPos.x + componentBoxWidth / 2}
                      y={compPos.y + 15}
                      textAnchor="middle"
                      fill={theme.colors.getContrastText(theme.colors.warning.main)}
                      style={{ fontSize: '12px', pointerEvents: 'none' }}
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
                fill={theme.colors.text.primary}
                fontSize="16"
                fontWeight="bold"
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

  function renderExtensionPointMode() {
    if (!data.extensions || !data.extensionPoints) {
      return null;
    }

    return (
      <g>
        {/* Render extensions on the left side */}
        {renderExtensions()}

        {/* Render extension points on the right side */}
        {renderExtensionPointsForMode()}
      </g>
    );
  }

  function renderExtensions() {
    if (!data.extensions) {
      return null;
    }

    // Group extensions by their providing plugin (app)
    const extensionGroups = new Map<string, string[]>();
    data.extensions.forEach((ext) => {
      if (!extensionGroups.has(ext.providingPlugin)) {
        extensionGroups.set(ext.providingPlugin, []);
      }
      extensionGroups.get(ext.providingPlugin)!.push(ext.id);
    });

    const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
    const extensionBoxHeight = 60;

    return (
      <g>
        {Array.from(extensionGroups.entries()).map(([providingPlugin, extensionIds]) => {
          const firstExtPos = extensionPositions.get(extensionIds[0]);
          if (!firstExtPos) {
            return null;
          }

          const groupHeight = firstExtPos.groupHeight;

          return (
            <g key={providingPlugin}>
              {/* App section box */}
              <rect
                x={firstExtPos.x - 20}
                y={firstExtPos.groupY}
                width={extensionBoxWidth + 40}
                height={groupHeight}
                fill={theme.colors.background.secondary}
                stroke={theme.colors.border.strong}
                strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
                rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
              />

              {/* Extensions inside app section */}
              {extensionIds.map((extId) => {
                const extPos = extensionPositions.get(extId);
                if (!extPos) {
                  return null;
                }

                const extension = data.extensions?.find((ext) => ext.id === extId);
                if (!extension) {
                  return null;
                }

                const extensionColor = getExtensionColor(extension.type);

                return (
                  <g key={extId}>
                    {/* Individual extension box */}
                    <rect
                      x={extPos.x}
                      y={extPos.y - extensionBoxHeight / 2}
                      width={extensionBoxWidth}
                      height={extensionBoxHeight}
                      fill={extensionColor}
                      stroke={theme.colors.border.strong}
                      strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
                      rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                    />

                    {/* Extension title */}
                    <text
                      x={extPos.x + extensionBoxWidth / 2}
                      y={extPos.y - 5}
                      textAnchor="middle"
                      fill={theme.colors.getContrastText(extensionColor)}
                    >
                      {extension.title || extension.id}
                    </text>

                    {/* Extension description */}
                    {options.showDescriptions && extension.description && extension.description.trim() !== '' && (
                      <text
                        x={extPos.x + extensionBoxWidth / 2}
                        y={extPos.y + 15}
                        textAnchor="middle"
                        fill={theme.colors.getContrastText(extensionColor)}
                      >
                        {extension.description}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* App name header */}
              <text x={firstExtPos.x} y={firstExtPos.groupY + 25} textAnchor="start" fill={theme.colors.text.primary}>
                {getDisplayName(providingPlugin)}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  function renderExtensionPointsForMode() {
    if (!data.extensionPoints) {
      return null;
    }

    // Group extension points by their defining plugin, then by type
    const extensionPointGroups = new Map<string, Map<string, string[]>>();
    data.extensionPoints.forEach((ep) => {
      if (!extensionPointGroups.has(ep.definingPlugin)) {
        extensionPointGroups.set(ep.definingPlugin, new Map());
      }
      const pluginGroup = extensionPointGroups.get(ep.definingPlugin)!;
      const extensionType = ep.extensionType || 'link';
      if (!pluginGroup.has(extensionType)) {
        pluginGroup.set(extensionType, []);
      }
      pluginGroup.get(extensionType)!.push(ep.id);
    });

    const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
    const extensionBoxHeight = 60;

    return (
      <g>
        {Array.from(extensionPointGroups.entries()).map(([definingPlugin, typeGroups]) => {
          // Get the first extension point to get group positioning info
          const firstTypeGroup = Array.from(typeGroups.values())[0];
          const firstEpPos = firstTypeGroup ? extensionPointModePositions.get(firstTypeGroup[0]) : null;
          if (!firstEpPos) {
            return null;
          }

          const groupHeight = firstEpPos.groupHeight;

          return (
            <g key={definingPlugin}>
              {/* Defining plugin group box */}
              <rect
                x={firstEpPos.x - 20}
                y={firstEpPos.groupY}
                width={extensionBoxWidth + 40}
                height={groupHeight}
                fill={theme.colors.background.secondary}
                stroke={theme.colors.border.strong}
                strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
                rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
              />

              {/* Render extension points by type (no headers in extension point mode) */}
              {['function', 'component', 'link'].map((type) => {
                const extensionPointIds = typeGroups.get(type);
                if (!extensionPointIds || extensionPointIds.length === 0) {
                  return null;
                }

                return (
                  <g key={`${definingPlugin}-${type}`}>
                    {/* Extension points for this type */}
                    {extensionPointIds.map((epId) => {
                      const epPos = extensionPointModePositions.get(epId);
                      if (!epPos) {
                        return null;
                      }

                      const extensionPoint = data.extensionPoints?.find((ep) => ep.id === epId);
                      if (!extensionPoint) {
                        return null;
                      }

                      return (
                        <g key={epId}>
                          {/* Extension point box */}
                          <rect
                            x={epPos.x}
                            y={epPos.y - extensionBoxHeight / 2}
                            width={extensionBoxWidth}
                            height={extensionBoxHeight}
                            fill={theme.colors.primary.main}
                            stroke={theme.colors.border.strong}
                            strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
                            rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                          />

                          {/* Extension point ID */}
                          {(() => {
                            const hasDescription =
                              extensionPoint.description && extensionPoint.description.trim() !== '';
                            const epIdY = hasDescription ? epPos.y - 5 : epPos.y;

                            return (
                              <text
                                x={epPos.x + extensionBoxWidth / 2}
                                y={epIdY}
                                textAnchor="middle"
                                dominantBaseline={hasDescription ? undefined : 'middle'}
                                fill={theme.colors.getContrastText(theme.colors.primary.main)}
                                style={{ fontSize: '12px', pointerEvents: 'none' }}
                              >
                                <tspan>{epId}</tspan>
                              </text>
                            );
                          })()}

                          {/* Extension point description */}
                          {extensionPoint.description && extensionPoint.description.trim() !== '' && (
                            <text
                              x={epPos.x + extensionBoxWidth / 2}
                              y={epPos.y + 10}
                              textAnchor="middle"
                              fill={theme.colors.getContrastText(theme.colors.primary.main)}
                              style={{ fontSize: '10px', pointerEvents: 'none' }}
                            >
                              <tspan>{extensionPoint.description}</tspan>
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Defining plugin name header */}
              <text
                x={firstEpPos.x}
                y={firstEpPos.groupY + 25}
                textAnchor="start"
                fill={theme.colors.text.primary}
                fontSize="16"
                fontWeight="bold"
              >
                {getDisplayName(definingPlugin)}
              </text>
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

    // Group extension points by their defining plugin, then by type
    const extensionPointGroups = new Map<string, Map<string, string[]>>();
    data.extensionPoints.forEach((ep) => {
      if (!extensionPointGroups.has(ep.definingPlugin)) {
        extensionPointGroups.set(ep.definingPlugin, new Map());
      }
      const pluginGroup = extensionPointGroups.get(ep.definingPlugin)!;
      const extensionType = ep.extensionType || 'link';
      if (!pluginGroup.has(extensionType)) {
        pluginGroup.set(extensionType, []);
      }
      pluginGroup.get(extensionType)!.push(ep.id);
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
        {Array.from(extensionPointGroups.entries()).map(([definingPlugin, typeGroups]) => {
          // Get the first extension point to get group positioning info
          const firstTypeGroup = Array.from(typeGroups.values())[0];
          const firstEpPos = firstTypeGroup ? extensionPointPositions.get(firstTypeGroup[0]) : null;
          if (!firstEpPos) {
            console.warn(`No first EP position found for plugin ${definingPlugin}`);
            return null;
          }

          const groupHeight = firstEpPos.groupHeight;

          // Debug: Log all type groups for this plugin
          console.log(`=== RENDERING ${definingPlugin} ===`);
          console.log(
            `Type groups:`,
            Array.from(typeGroups.entries()).map(([type, ids]) => `${type}: ${ids.length} items`)
          );
          console.log(
            `Extension point positions available:`,
            Array.from(extensionPointPositions.keys()).filter((key) => key.includes(definingPlugin))
          );

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
              />

              {/* Render extension points by type with headers */}
              {['function', 'component', 'link'].map((type) => {
                const extensionPointIds = typeGroups.get(type);
                console.log(
                  `CHECKING TYPE ${type} for ${definingPlugin}: ${extensionPointIds ? extensionPointIds.length : 0} extension points`
                );
                if (!extensionPointIds || extensionPointIds.length === 0) {
                  console.log(`SKIPPING TYPE ${type} for ${definingPlugin} - no extension points`);
                  return null;
                }

                const firstEpInType = extensionPointPositions.get(extensionPointIds[0]);

                if (!firstEpInType) {
                  console.warn(
                    `No position found for first extension point of type ${type} in plugin ${definingPlugin}`
                  );
                  return null;
                }

                // Ensure we have valid positioning data
                if (typeof firstEpInType.y !== 'number' || isNaN(firstEpInType.y)) {
                  console.warn(
                    `Invalid Y position for extension point ${extensionPointIds[0]} in plugin ${definingPlugin}`
                  );
                  return null;
                }

                // Calculate header position using the stored typeHeaderY
                const headerY = firstEpInType.typeHeaderY || firstEpInType.y - 40;
                const headerX = firstEpPos.x + extensionBoxWidth / 2;

                // Ensure header position is valid
                if (isNaN(headerY) || isNaN(headerX)) {
                  console.warn(
                    `Invalid header position for type ${type} in plugin ${definingPlugin}: x=${headerX}, y=${headerY}`
                  );
                  return null;
                }

                return (
                  <g key={`${definingPlugin}-${type}`}>
                    {/* Type header - always show if there are extension points of this type */}
                    <text
                      x={firstEpPos.x}
                      y={headerY}
                      textAnchor="start"
                      fill={theme.colors.text.primary}
                      fontSize="12"
                      fontWeight="normal"
                      style={{
                        pointerEvents: 'none',
                        zIndex: 1000,
                      }}
                    >
                      {type === 'function' ? (
                        <Trans i18nKey="extensions.dependency-graph.function-extensions">Function extensions</Trans>
                      ) : type === 'component' ? (
                        <Trans i18nKey="extensions.dependency-graph.component-extensions">Component extensions</Trans>
                      ) : (
                        <Trans i18nKey="extensions.dependency-graph.link-extensions">Link extensions</Trans>
                      )}
                    </text>

                    {/* Extension points for this type */}
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
                            stroke={theme.colors.border.strong}
                            strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
                            rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                            onClick={() => {
                              // Navigate to extension point mode with this specific extension point selected
                              const currentUrl = new URL(window.location.href);
                              currentUrl.searchParams.set('apiMode', 'extensionpoint');
                              currentUrl.searchParams.set('extensionPoints', epId);
                              locationService.push(currentUrl.pathname + currentUrl.search);

                              // Scroll to top of the page after navigation
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            style={{ cursor: 'pointer' }}
                          />

                          {/* Extension point ID - first line */}
                          {(() => {
                            const hasDescription =
                              extensionPoint?.description && extensionPoint.description.trim() !== '';
                            const epIdY = hasDescription
                              ? options.showDependencyTypes
                                ? epPos.y - 5
                                : epPos.y + 5
                              : epPos.y;

                            return (
                              <text
                                x={epPos.x + extensionBoxWidth / 2}
                                y={epIdY}
                                textAnchor="middle"
                                dominantBaseline={hasDescription ? undefined : 'middle'}
                                fill={theme.colors.getContrastText(extensionColor)}
                                style={{ fontSize: '12px', pointerEvents: 'none' }}
                              >
                                {epId}
                              </text>
                            );
                          })()}

                          {/* Extension point description - second line */}
                          {extensionPoint?.description && extensionPoint.description.trim() !== '' && (
                            <text
                              x={epPos.x + extensionBoxWidth / 2}
                              y={options.showDependencyTypes ? epPos.y + 10 : epPos.y + 20}
                              textAnchor="middle"
                              fill={theme.colors.getContrastText(extensionColor)}
                              style={{ fontSize: '10px', pointerEvents: 'none' }}
                            >
                              {extensionPoint.description}
                            </text>
                          )}

                          {/* Extension type - third line in parentheses */}
                          {options.showDependencyTypes && (
                            <g>
                              <text
                                x={epPos.x + extensionBoxWidth / 2}
                                y={epPos.y + 30}
                                textAnchor="middle"
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
                                    y={epPos.y + 45}
                                    textAnchor="middle"
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
                  </g>
                );
              })}

              {/* Defining plugin name header */}
              <text
                x={firstEpPos.x}
                y={firstEpPos.groupY + 22}
                textAnchor="start"
                fill={theme.colors.text.primary}
                fontSize="16"
                fontWeight="bold"
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
