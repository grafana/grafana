import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { CatalogPluginInsights, InsightLevel, SCORE_LEVELS } from '../types';

import { PluginInsights } from './PluginInsights';

const mockPluginInsights: CatalogPluginInsights = {
  id: 1,
  name: 'test-plugin',
  version: '1.0.0',
  insights: [
    {
      name: 'security',
      scoreValue: 90,
      scoreLevel: SCORE_LEVELS.EXCELLENT,
      items: [
        {
          id: 'signature',
          name: 'Signature verified',
          description: 'Plugin signature is valid',
          level: 'ok' as InsightLevel,
        },
        {
          id: 'trackingscripts',
          name: 'No unsafe JavaScript detected',
          level: 'good' as InsightLevel,
        },
      ],
    },
    {
      name: 'quality',
      scoreValue: 60,
      scoreLevel: SCORE_LEVELS.FAIR,
      items: [
        {
          id: 'metadatavalid',
          name: 'Metadata is valid',
          level: 'ok' as InsightLevel,
        },
        {
          id: 'code-rules',
          name: 'Missing code rules',
          description: 'Plugin lacks comprehensive code rules',
          level: 'warning' as InsightLevel,
        },
      ],
    },
  ],
};

const mockPluginInsightsWithPoorLevel: CatalogPluginInsights = {
  id: 3,
  name: 'test-plugin-poor',
  version: '0.8.0',
  insights: [
    {
      name: 'quality',
      scoreValue: 35,
      scoreLevel: SCORE_LEVELS.POOR,
      items: [
        {
          id: 'legacy-platform',
          name: 'Quality issues detected',
          level: 'warning' as InsightLevel,
        },
      ],
    },
  ],
};

describe('PluginInsights', () => {
  it('should render plugin insights section', () => {
    render(<PluginInsights pluginInsights={mockPluginInsights} />);
    const insightsSection = screen.getByTestId('plugin-insights-container');
    expect(insightsSection).toBeInTheDocument();
    expect(screen.getByText('Plugin insights')).toBeInTheDocument();
  });

  it('should render all insight categories with test ids', () => {
    render(<PluginInsights pluginInsights={mockPluginInsights} />);
    expect(screen.getByTestId('plugin-insight-security')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-insight-quality')).toBeInTheDocument();
  });

  it('should render category names with test ids', () => {
    render(<PluginInsights pluginInsights={mockPluginInsights} />);
    const securityCategory = screen.getByTestId('plugin-insight-security');
    const qualityCategory = screen.getByTestId('plugin-insight-quality');

    expect(securityCategory).toBeInTheDocument();
    expect(securityCategory).toHaveTextContent('Security');
    expect(qualityCategory).toBeInTheDocument();
    expect(qualityCategory).toHaveTextContent('Quality');
  });

  it('should render individual insight items with test ids', async () => {
    render(<PluginInsights pluginInsights={mockPluginInsights} />);
    await userEvent.click(screen.getByText('Security'));
    expect(screen.getByTestId('plugin-insight-item-signature')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-insight-item-trackingscripts')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Quality'));
    expect(screen.getByTestId('plugin-insight-item-metadatavalid')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-insight-item-code-rules')).toBeInTheDocument();
  });

  it('should display correct icons for Excellent score level', () => {
    render(<PluginInsights pluginInsights={mockPluginInsights} />);

    const securityCategory = screen.getByTestId('plugin-insight-security');
    const securityIcon = securityCategory.querySelector('[data-testid="excellent-icon"]');
    expect(securityIcon).toBeInTheDocument();
  });

  it('should display correct icons for Poor score levels', () => {
    // Test Poor level - should show exclamation-triangle
    render(<PluginInsights pluginInsights={mockPluginInsightsWithPoorLevel} />);
    const poorCategory = screen.getByTestId('plugin-insight-quality');
    const poorIcon = poorCategory.querySelector('[data-testid="poor-icon"]');
    expect(poorIcon).toBeInTheDocument();
  });

  it('should handle multiple items with different insight levels', async () => {
    const multiLevelInsights: CatalogPluginInsights = {
      id: 5,
      name: 'multi-level-plugin',
      version: '2.0.0',
      insights: [
        {
          name: 'quality',
          scoreValue: 75,
          scoreLevel: SCORE_LEVELS.GOOD,
          items: [
            {
              id: 'code-rules',
              name: 'Info level item',
              level: 'info' as InsightLevel,
            },
            {
              id: 'sdk-usage',
              name: 'OK level item',
              level: 'ok' as InsightLevel,
            },
            {
              id: 'jsMap',
              name: 'Good level item',
              level: 'good' as InsightLevel,
            },
            {
              id: 'gosec',
              name: 'Warning level item',
              level: 'warning' as InsightLevel,
            },
            {
              id: 'legacy-builder',
              name: 'Danger level item',
              level: 'danger' as InsightLevel,
            },
          ],
        },
      ],
    };
    render(<PluginInsights pluginInsights={multiLevelInsights} />);
    await userEvent.click(screen.getByText('Quality'));
    expect(screen.getByText('Info level item')).toBeInTheDocument();
    expect(screen.getByText('OK level item')).toBeInTheDocument();
    expect(screen.getByText('Good level item')).toBeInTheDocument();
    expect(screen.getByText('Warning level item')).toBeInTheDocument();
    expect(screen.getByText('Danger level item')).toBeInTheDocument();
  });
});
