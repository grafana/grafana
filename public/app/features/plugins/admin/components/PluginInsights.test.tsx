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
      name: 'Security',
      scoreValue: 90,
      scoreLevel: 'Excellent' as ScoreLevel,
      items: [
        {
          id: 'signature_verified',
          name: 'Signature verified',
          description: 'Plugin signature is valid',
          level: 'ok' as InsightLevel,
        },
        {
          id: 'no_unsafe_js',
          name: 'No unsafe JavaScript detected',
          level: 'good' as InsightLevel,
        },
      ],
    },
    {
      name: 'Quality',
      scoreValue: 60,
      scoreLevel: 'Fair' as ScoreLevel,
      items: [
        {
          id: 'screenshots_available',
          name: 'Screenshots available',
          level: 'ok' as InsightLevel,
        },
        {
          id: 'missing_documentation',
          name: 'Missing documentation',
          description: 'Plugin lacks comprehensive documentation',
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
      name: 'Security',
      scoreValue: 20,
      scoreLevel: 'Critical' as ScoreLevel,
      items: [
        {
          id: 'critical_vulnerability',
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
      name: 'Quality',
      scoreValue: 35,
      scoreLevel: 'Poor' as ScoreLevel,
      items: [
        {
          id: 'quality_issue',
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
    expect(screen.getByTestId('plugin-insight-item-signature_verified')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-insight-item-no_unsafe_js')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Quality'));
    expect(screen.getByTestId('plugin-insight-item-screenshots_available')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-insight-item-missing_documentation')).toBeInTheDocument();
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
    const { container } = render(<PluginInsights pluginInsights={emptyInsights} />);
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
          name: 'Mixed Items',
          scoreValue: 75,
          scoreLevel: 'Good' as ScoreLevel,
          items: [
            {
              id: 'info_item',
              name: 'Info level item',
              level: 'info' as InsightLevel,
            },
            {
              id: 'ok_item',
              name: 'OK level item',
              level: 'ok' as InsightLevel,
            },
            {
              id: 'good_item',
              name: 'Good level item',
              level: 'good' as InsightLevel,
            },
            {
              id: 'warning_item',
              name: 'Warning level item',
              level: 'warning' as InsightLevel,
            },
            {
              id: 'danger_item',
              name: 'Danger level item',
              level: 'danger' as InsightLevel,
            },
          ],
        },
      ],
    };
    render(<PluginInsights pluginInsights={multiLevelInsights} />);
    await userEvent.click(screen.getByText('Mixed Items'));
    expect(screen.getByText('Info level item')).toBeInTheDocument();
    expect(screen.getByText('OK level item')).toBeInTheDocument();
    expect(screen.getByText('Good level item')).toBeInTheDocument();
    expect(screen.getByText('Warning level item')).toBeInTheDocument();
    expect(screen.getByText('Danger level item')).toBeInTheDocument();
  });
});
