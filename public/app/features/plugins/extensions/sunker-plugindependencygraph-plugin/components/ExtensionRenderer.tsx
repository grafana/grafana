/**
 * Extension Renderer Component
 *
 * Renders extension points and exposed components in the dependency graph.
 */

import {
  COLOR_DEFAULTS,
  DISPLAY_NAMES,
  LAYOUT_CONSTANTS,
  VISUAL_CONSTANTS,
  getResponsiveComponentWidth,
  getResponsiveGroupSpacing,
} from '../constants';
import { GraphData, PanelOptions } from '../types';

import { GrafanaTheme2 } from '@grafana/data';
import { PositionInfo } from './GraphLayout';
import React from 'react';
import { SerializedStyles } from '@emotion/react';
import { Trans } from '@grafana/i18n';

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
              <text x={firstCompPos.x} y={firstCompPos.groupY + 25} textAnchor="start" fill={theme.colors.text.primary}>
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

    const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
    const extensionBoxHeight = 60;

    return (
      <g>
        {data.extensionPoints.map((ep) => {
          const epPos = extensionPointModePositions.get(ep.id);
          if (!epPos) {
            return null;
          }

          return (
            <g key={ep.id}>
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
              <text
                x={epPos.x + extensionBoxWidth / 2}
                y={epPos.y - 5}
                textAnchor="middle"
                fill={theme.colors.getContrastText(theme.colors.primary.main)}
                style={{ fontSize: '12px', pointerEvents: 'none' }}
              >
                <tspan>{ep.id}</tspan>
              </text>

              {/* "Defined in [appname]" */}
              <text
                x={epPos.x + extensionBoxWidth / 2}
                y={epPos.y + 10}
                textAnchor="middle"
                fill={theme.colors.getContrastText(theme.colors.primary.main)}
                style={{ fontSize: '11px', pointerEvents: 'none' }}
              >
                <tspan>
                  <Trans i18nKey="extensions.defined-in" values={{ plugin: ep.definingPlugin }}>
                    Defined in {{ plugin: ep.definingPlugin }}
                  </Trans>
                </tspan>
              </text>

              {/* Extension point description */}
              {options.showDescriptions && ep.description && ep.description.trim() !== '' && (
                <text
                  x={epPos.x + extensionBoxWidth / 2}
                  y={epPos.y + 25}
                  textAnchor="middle"
                  fill={theme.colors.getContrastText(theme.colors.primary.main)}
                  style={{ pointerEvents: 'none' }}
                >
                  <tspan>{ep.description}</tspan>
                </text>
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
                      stroke={theme.colors.border.strong}
                      strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
                      rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                    />

                    {/* Extension point ID - first line */}
                    <text
                      x={epPos.x + extensionBoxWidth / 2}
                      y={options.showDependencyTypes ? epPos.y - 5 : epPos.y + 5}
                      textAnchor="middle"
                      fill={theme.colors.getContrastText(extensionColor)}
                      style={{ pointerEvents: 'none' }}
                    >
                      {epId}
                    </text>

                    {/* "Defined in [appname]" - second line */}
                    <text
                      x={epPos.x + extensionBoxWidth / 2}
                      y={epPos.y + 15}
                      textAnchor="middle"
                      fill={theme.colors.getContrastText(extensionColor)}
                      style={{ pointerEvents: 'none', fontSize: '11px' }}
                    >
                      <Trans
                        i18nKey="extensions.defined-in"
                        values={{ plugin: extensionPoint?.definingPlugin || 'unknown' }}
                      >
                        Defined in {{ plugin: extensionPoint?.definingPlugin || 'unknown' }}
                      </Trans>
                    </text>

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

              {/* Defining plugin name header */}
              <text x={firstEpPos.x} y={firstEpPos.groupY + 22} textAnchor="start" fill={theme.colors.text.primary}>
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
