/**
 * Provider Drill Down Component
 *
 * Shows detailed information about a specific provider plugin.
 * This follows Grafana scenes patterns for drill-down navigation.
 */

import React from 'react';

import { t } from '@grafana/i18n';
import { Button, useTheme2 } from '@grafana/ui';

import { LAYOUT_CONSTANTS, VISUAL_CONSTANTS } from '../constants';
import { GraphData, PanelOptions, PluginNode } from '../types';

interface ProviderDrillDownProps {
  provider: PluginNode;
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
  onBack: () => void;
}

export const ProviderDrillDown: React.FC<ProviderDrillDownProps> = ({
  provider,
  data,
  options,
  width,
  height,
  onBack,
}) => {
  const theme = useTheme2();

  // Find all extension points this provider extends
  const extensionPoints = data.extensionPoints.filter((ep) => ep.providers.includes(provider.id));

  // Calculate layout dimensions
  const leftPanelWidth = Math.max(300, width * 0.4);
  const rightPanelWidth = Math.max(300, width * 0.4);
  const centerSpacing = width * 0.2;

  const leftPanelX = 20;
  const rightPanelX = leftPanelX + leftPanelWidth + centerSpacing;
  const panelY = 80;
  const panelHeight = height - 120;

  // Extension point box dimensions
  const extensionBoxWidth = Math.min(leftPanelWidth - 40, LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH);
  const extensionBoxHeight = options.showDependencyTypes
    ? LAYOUT_CONSTANTS.EXTENSION_BOX_HEIGHT
    : LAYOUT_CONSTANTS.EXTENSION_BOX_HEIGHT_NO_TYPE;

  // Provider box dimensions
  const providerBoxWidth = rightPanelWidth - 40;
  const providerBoxHeight = 80;

  // Get extension point color
  const getExtensionColor = (type: string): string => {
    switch (type) {
      case 'component':
        return options.componentExtensionColor || '#ff9900';
      case 'function':
        return options.functionExtensionColor || '#e02f44';
      case 'link':
      default:
        return options.linkExtensionColor || '#37872d';
    }
  };

  return (
    <div style={{ width, height, position: 'relative' }}>
      {/* Header with breadcrumb navigation */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 20,
          right: 20,
          height: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.colors.border.medium}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing(1) }}>
          <Button
            variant="secondary"
            size="sm"
            icon="arrow-left"
            onClick={onBack}
            style={{ marginRight: theme.spacing(1) }}
          >
            {t('extensions.dependency-graph.back', 'Back')}
          </Button>
          <span style={{ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }}>/</span>
          <h2 style={{ margin: 0, color: theme.colors.text.primary, fontSize: theme.typography.h4.fontSize }}>
            {t('extensions.dependency-graph.provider-details', 'Provider Details')}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing(1) }}>
          <span style={{ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }}>
            {provider.id}
          </span>
        </div>
      </div>

      {/* Main content */}
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Left panel - Extension Points */}
        <g>
          {/* Left panel background */}
          <rect
            x={leftPanelX}
            y={panelY}
            width={leftPanelWidth}
            height={panelHeight}
            fill={theme.colors.background.secondary}
            stroke={theme.colors.border.strong}
            strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
            rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
          />

          {/* Left panel title */}
          <text x={leftPanelX + 20} y={panelY + 30} className="text-lg font-semibold" fill={theme.colors.text.primary}>
            {t('extensions.dependency-graph.extension-points-count', 'Extension Points ({{count}})', {
              count: extensionPoints.length,
            })}
          </text>

          {/* Extension point boxes */}
          {extensionPoints.map((extensionPoint, index) => {
            const extensionY = panelY + 60 + index * (extensionBoxHeight + 20);
            const extensionColor = getExtensionColor(extensionPoint.extensionType || 'link');

            return (
              <g key={extensionPoint.id}>
                {/* Extension point box */}
                <rect
                  x={leftPanelX + 20}
                  y={extensionY}
                  width={extensionBoxWidth}
                  height={extensionBoxHeight}
                  fill={extensionColor}
                  stroke={theme.colors.border.strong}
                  strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
                  rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                />

                {/* Extension point ID */}
                <text
                  x={leftPanelX + 30}
                  y={extensionY + 20}
                  className="text-sm font-medium"
                  fill={theme.colors.getContrastText(extensionColor)}
                >
                  {extensionPoint.id}
                </text>

                {/* Extension type */}
                {options.showDependencyTypes && (
                  <text
                    x={leftPanelX + 30}
                    y={extensionY + 35}
                    className="text-xs"
                    fill={theme.colors.getContrastText(extensionColor)}
                  >
                    {t('extensions.dependency-graph.extension-type', '({{type}} extension)', {
                      type: extensionPoint.extensionType,
                    })}
                  </text>
                )}
              </g>
            );
          })}

          {/* No extension points message */}
          {extensionPoints.length === 0 && (
            <text
              x={leftPanelX + leftPanelWidth / 2}
              y={panelY + panelHeight / 2}
              textAnchor="middle"
              className="text-sm"
              fill={theme.colors.text.secondary}
            >
              {t('extensions.dependency-graph.no-extension-points-found', 'No extension points found')}
            </text>
          )}
        </g>

        {/* Right panel - Provider */}
        <g>
          {/* Right panel background */}
          <rect
            x={rightPanelX}
            y={panelY}
            width={rightPanelWidth}
            height={panelHeight}
            fill={theme.colors.background.secondary}
            stroke={theme.colors.border.strong}
            strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
            rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
          />

          {/* Right panel title */}
          <text x={rightPanelX + 20} y={panelY + 30} className="text-lg font-semibold" fill={theme.colors.text.primary}>
            {t('extensions.dependency-graph.provider', 'Provider')}
          </text>

          {/* Provider box */}
          <rect
            x={rightPanelX + 20}
            y={panelY + 60}
            width={providerBoxWidth}
            height={providerBoxHeight}
            fill={theme.colors.primary.main}
            stroke={theme.colors.border.strong}
            strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
            rx={VISUAL_CONSTANTS.NODE_BORDER_RADIUS}
          />

          {/* Provider name */}
          <text
            x={rightPanelX + 30}
            y={panelY + 60 + 25}
            className="text-lg font-semibold"
            fill={theme.colors.getContrastText(theme.colors.primary.main)}
          >
            {provider.name}
          </text>

          {/* Provider ID */}
          <text
            x={rightPanelX + 30}
            y={panelY + 60 + 45}
            className="text-sm"
            fill={theme.colors.getContrastText(theme.colors.primary.main)}
          >
            {provider.id}
          </text>

          {/* Provider description */}
          {provider.description && (
            <text
              x={rightPanelX + 20}
              y={panelY + 60 + providerBoxHeight + 30}
              className="text-sm"
              fill={theme.colors.text.secondary}
            >
              {t('extensions.dependency-graph.description', 'Description: {{description}}', {
                description: provider.description,
              })}
            </text>
          )}

          {/* Provider type */}
          <text
            x={rightPanelX + 20}
            y={panelY + 60 + providerBoxHeight + 50}
            className="text-sm"
            fill={theme.colors.text.secondary}
          >
            {t('extensions.dependency-graph.type', 'Type: {{type}}', { type: provider.type })}
          </text>

          {/* Provider version */}
          {provider.version && (
            <text
              x={rightPanelX + 20}
              y={panelY + 60 + providerBoxHeight + 70}
              className="text-sm"
              fill={theme.colors.text.secondary}
            >
              {t('extensions.dependency-graph.version', 'Version: {{version}}', { version: provider.version })}
            </text>
          )}
        </g>

        {/* Connection arrows from extension points to provider */}
        {extensionPoints.map((extensionPoint, index) => {
          const extensionY = panelY + 60 + index * (extensionBoxHeight + 20) + extensionBoxHeight / 2;
          const providerY = panelY + 60 + providerBoxHeight / 2;

          return (
            <g key={`arrow-${extensionPoint.id}`}>
              {/* Arrow line */}
              <line
                x1={leftPanelX + 20 + extensionBoxWidth}
                y1={extensionY}
                x2={rightPanelX + 20}
                y2={providerY}
                stroke={theme.colors.text.secondary}
                strokeWidth={2}
                markerEnd="url(#arrowhead)"
              />
            </g>
          );
        })}

        {/* Arrow marker definition */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={theme.colors.text.secondary} />
          </marker>
        </defs>
      </svg>
    </div>
  );
};
