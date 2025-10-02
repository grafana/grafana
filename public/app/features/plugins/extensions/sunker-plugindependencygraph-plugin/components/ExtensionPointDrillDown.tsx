/**
 * Extension Point Drill Down Component
 *
 * Shows a detailed view of an extension point with its providers.
 * Displays the extension point on the right and provider boxes on the left.
 *
 * This follows Grafana scenes patterns for drill-down navigation.
 */

import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, useTheme2 } from '@grafana/ui';

import { LAYOUT_CONSTANTS, VISUAL_CONSTANTS } from '../constants';
import { ExtensionPoint, GraphData, PanelOptions } from '../types';

interface ExtensionPointDrillDownProps {
  extensionPoint: ExtensionPoint;
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
  onBack: () => void;
  onNavigateToProvider?: (providerId: string) => void;
}

export const ExtensionPointDrillDown: React.FC<ExtensionPointDrillDownProps> = ({
  extensionPoint,
  data,
  options,
  width,
  height,
  onBack,
  onNavigateToProvider,
}) => {
  const theme = useTheme2();

  // Get all providers for this extension point
  const providers = extensionPoint.providers.map((providerId) => {
    const node = data.nodes.find((n) => n.id === providerId);
    return {
      id: providerId,
      name: node?.name || providerId,
      description: node?.description || '',
    };
  });

  // Calculate layout dimensions
  const leftPanelWidth = Math.max(300, width * 0.4); // 40% of width for providers
  const rightPanelWidth = Math.max(300, width * 0.4); // 40% of width for extension point
  const centerSpacing = width * 0.2; // 20% for spacing

  const leftPanelX = 20;
  const rightPanelX = leftPanelX + leftPanelWidth + centerSpacing;
  const panelY = 80;
  const panelHeight = height - 120;

  // Extension point box dimensions
  const extensionBoxWidth = Math.min(rightPanelWidth - 40, LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH);
  const extensionBoxHeight = options.showDependencyTypes
    ? LAYOUT_CONSTANTS.EXTENSION_BOX_HEIGHT
    : LAYOUT_CONSTANTS.EXTENSION_BOX_HEIGHT_NO_TYPE;

  // Provider box dimensions
  const providerBoxWidth = leftPanelWidth - 40;
  const providerBoxHeight = 60;
  const providerSpacing = 20;

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

  const extensionColor = getExtensionColor(extensionPoint.extensionType || 'link');

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
            {t('extensions.dependency-graph.extension-point-details', 'Extension Point Details')}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing(1) }}>
          <span style={{ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }}>
            {extensionPoint.id}
          </span>
        </div>
      </div>

      {/* Main content */}
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Left panel - Providers */}
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
            {t('extensions.dependency-graph.providers-count', 'Providers ({{count}})', { count: providers.length })}
          </text>

          {/* Provider boxes */}
          {providers.map((provider, index) => {
            const providerY = panelY + 60 + index * (providerBoxHeight + providerSpacing);

            return (
              <g key={provider.id}>
                {/* Provider box */}
                <rect
                  x={leftPanelX + 20}
                  y={providerY}
                  width={providerBoxWidth}
                  height={providerBoxHeight}
                  fill={theme.colors.primary.main}
                  stroke={theme.colors.border.strong}
                  strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
                  rx={VISUAL_CONSTANTS.NODE_BORDER_RADIUS}
                  style={{ cursor: onNavigateToProvider ? 'pointer' : 'default' }}
                  onClick={() => onNavigateToProvider?.(provider.id)}
                />

                {/* Provider name */}
                <text
                  x={leftPanelX + 30}
                  y={providerY + 20}
                  className="text-sm font-medium"
                  fill={theme.colors.getContrastText(theme.colors.primary.main)}
                >
                  {provider.name}
                </text>

                {/* Provider description */}
                {provider.description && (
                  <text
                    x={leftPanelX + 30}
                    y={providerY + 40}
                    className="text-xs"
                    fill={theme.colors.getContrastText(theme.colors.primary.main)}
                  >
                    {provider.description}
                  </text>
                )}
              </g>
            );
          })}

          {/* No providers message */}
          {providers.length === 0 && (
            <text
              x={leftPanelX + leftPanelWidth / 2}
              y={panelY + panelHeight / 2}
              textAnchor="middle"
              className="text-sm"
              fill={theme.colors.text.secondary}
            >
              {t('extensions.dependency-graph.no-providers-found', 'No providers found')}
            </text>
          )}
        </g>

        {/* Right panel - Extension Point */}
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
            {t('extensions.dependency-graph.extension-point', 'Extension Point')}
          </text>

          {/* Extension point box */}
          <rect
            x={rightPanelX + 20}
            y={panelY + 60}
            width={extensionBoxWidth}
            height={extensionBoxHeight}
            fill={extensionColor}
            stroke={theme.colors.border.strong}
            strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
            rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
          />

          {/* Extension point ID */}
          <text
            x={rightPanelX + 20 + extensionBoxWidth / 2}
            y={panelY + 60 + (options.showDependencyTypes ? 15 : 20)}
            textAnchor="middle"
            className="text-sm font-medium"
            fill={theme.colors.getContrastText(extensionColor)}
          >
            {extensionPoint.id}
          </text>

          {/* Extension type */}
          {options.showDependencyTypes && (
            <text
              x={rightPanelX + 20 + extensionBoxWidth / 2}
              y={panelY + 60 + 30}
              textAnchor="middle"
              className="text-xs"
              fill={theme.colors.getContrastText(extensionColor)}
            >
              {t('extensions.dependency-graph.extension-type', '({{type}} extension)', {
                type: extensionPoint.extensionType,
              })}
            </text>
          )}

          {/* Extension point title */}
          {extensionPoint.title && (
            <text
              x={rightPanelX + 20}
              y={panelY + 60 + extensionBoxHeight + 30}
              className="text-sm font-semibold"
              fill={theme.colors.text.primary}
            >
              {t('extensions.dependency-graph.title', 'Title: {{title}}', { title: extensionPoint.title })}
            </text>
          )}

          {/* Extension point description */}
          {extensionPoint.description && (
            <text
              x={rightPanelX + 20}
              y={panelY + 60 + extensionBoxHeight + 50}
              className="text-sm"
              fill={theme.colors.text.secondary}
            >
              {t('extensions.dependency-graph.description', 'Description: {{description}}', {
                description: extensionPoint.description,
              })}
            </text>
          )}

          {/* Defining plugin */}
          <text
            x={rightPanelX + 20}
            y={panelY + 60 + extensionBoxHeight + 80}
            className="text-sm"
            fill={theme.colors.text.secondary}
          >
            {t('extensions.dependency-graph.defined-by', 'Defined by: {{plugin}}', {
              plugin: extensionPoint.definingPlugin,
            })}
          </text>
        </g>

        {/* Connection arrows from providers to extension point */}
        {providers.map((provider, index) => {
          const providerY = panelY + 60 + index * (providerBoxHeight + providerSpacing) + providerBoxHeight / 2;
          const extensionY = panelY + 60 + extensionBoxHeight / 2;

          return (
            <g key={`arrow-${provider.id}`}>
              {/* Arrow line */}
              <line
                x1={leftPanelX + 20 + providerBoxWidth}
                y1={providerY}
                x2={rightPanelX + 20}
                y2={extensionY}
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
