import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { CatalogPluginInsights, ScoreLevel, InsightLevel } from '../types';

import { PluginInsights } from './PluginInsights';

const mockPluginInsights: CatalogPluginInsights = {
  id: 1,
  name: 'test-plugin',
  version: '1.0.0',
  insights: [
    {
      name: 'security',
      scoreValue: 90,
      scoreLevel: 'Excellent' as ScoreLevel,
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
      scoreLevel: 'Fair' as ScoreLevel,
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

const mockPluginInsightsWithDangerLevel: CatalogPluginInsights = {
  id: 2,
  name: 'test-plugin-danger',
  version: '0.5.0',
  insights: [
    {
      name: 'security',
      scoreValue: 20,
      scoreLevel: 'Critical' as ScoreLevel,
      items: [
        {
          id: 'virus-scan',
          name: 'Critical vulnerability detected',
          description: 'Severe security issue found',
          level: 'danger' as InsightLevel,
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
      scoreLevel: 'Poor' as ScoreLevel,
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
    expect(securityCategory).toHaveTextContent('security');
    expect(qualityCategory).toBeInTheDocument();
    expect(qualityCategory).toHaveTextContent('quality');
  });

  it('should render individual insight items with test ids', async () => {
    render(<PluginInsights pluginInsights={mockPluginInsights} />);
    await userEvent.click(screen.getByText('security'));
    expect(screen.getByTestId('plugin-insight-item-signature')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-insight-item-trackingscripts')).toBeInTheDocument();
    await userEvent.click(screen.getByText('quality'));
    expect(screen.getByTestId('plugin-insight-item-metadatavalid')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-insight-item-code-rules')).toBeInTheDocument();
  });

  it('should display correct colors for Excellent and Fair score levels', () => {
    render(<PluginInsights pluginInsights={mockPluginInsights} />);

    // Excellent score level should be green
    const securityColorPicker = screen.getByTestId('plugin-insight-security');
    const securityColorButton = securityColorPicker.querySelector('button');
    expect(securityColorButton).toHaveStyle({ background: '#1a7f4b' });

    // Fair score level should be orange
    const qualityColorPicker = screen.getByTestId('plugin-insight-quality');
    const qualityColorButton = qualityColorPicker.querySelector('button');
    expect(qualityColorButton).toHaveStyle({ background: '#ff9900' });
  });

  it('should display correct colors for Poor and Critical score levels', () => {
    // Test Poor level (red)
    const { rerender } = render(<PluginInsights pluginInsights={mockPluginInsightsWithPoorLevel} />);
    const poorColorPicker = screen.getByTestId('plugin-insight-quality');
    const poorColorButton = poorColorPicker.querySelector('button');
    expect(poorColorButton).toHaveStyle({ background: '#d10e5c' });

    // Test Critical level (red)
    rerender(<PluginInsights pluginInsights={mockPluginInsightsWithDangerLevel} />);
    const criticalColorPicker = screen.getByTestId('plugin-insight-security');
    const criticalColorButton = criticalColorPicker.querySelector('button');
    expect(criticalColorButton).toHaveStyle({ background: '#d10e5c' });
  });

  it('should render empty insights array without errors', () => {
    const emptyInsights: CatalogPluginInsights = {
      id: 4,
      name: 'empty-plugin',
      version: '1.0.0',
      insights: [],
    };
    render(<PluginInsights pluginInsights={emptyInsights} />);
    const insightsSection = screen.getByTestId('plugin-insights-container');
    expect(insightsSection).toBeInTheDocument();
    expect(screen.getByText('Plugin insights')).toBeInTheDocument();
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
          scoreLevel: 'Good' as ScoreLevel,
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
    await userEvent.click(screen.getByText('quality'));
    expect(screen.getByText('Info level item')).toBeInTheDocument();
    expect(screen.getByText('OK level item')).toBeInTheDocument();
    expect(screen.getByText('Good level item')).toBeInTheDocument();
    expect(screen.getByText('Warning level item')).toBeInTheDocument();
    expect(screen.getByText('Danger level item')).toBeInTheDocument();
  });
});
