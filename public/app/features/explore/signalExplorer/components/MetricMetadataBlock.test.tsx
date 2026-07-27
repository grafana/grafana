import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { colorManipulator, createTheme } from '@grafana/data';

import type { MetricRow, MetricType } from '../types';

import { MetricMetadataBlock, getMetricTypeBadgeColor } from './MetricMetadataBlock';

describe('MetricMetadataBlock', () => {
  it('shows the type, name, help and unit of the selected metric', () => {
    render(
      <MetricMetadataBlock
        metricName="up"
        metric={{ name: 'up', type: 'gauge', help: 'Target liveness', unit: 'bool' }}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('signal-explorer-metric-type-badge')).toHaveTextContent('Gauge');
    expect(screen.getByRole('heading', { name: 'up' })).toBeInTheDocument();
    expect(screen.getByText('Target liveness')).toBeInTheDocument();
    expect(screen.getByText('bool')).toBeInTheDocument();
  });

  it('omits the unit line entirely when unit is undefined', () => {
    render(
      <MetricMetadataBlock metricName="up" metric={{ name: 'up', type: 'gauge', help: 'up' }} onClose={jest.fn()} />
    );

    expect(screen.queryByTestId('metric-metadata-unit')).not.toBeInTheDocument();
  });

  // The catalog that describes the metric may still be loading when the user clicks a row. Showing
  // the name they just picked beats an empty panel that pops into place a moment later.
  it('names the metric before its metadata has resolved, without a type badge', () => {
    render(<MetricMetadataBlock metricName="node_load1" metric={undefined} onClose={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'node_load1' })).toBeInTheDocument();
    expect(screen.queryByTestId('signal-explorer-metric-type-badge')).not.toBeInTheDocument();
  });

  it('calls onClose when the close control is activated', async () => {
    const onClose = jest.fn();
    render(<MetricMetadataBlock metricName="up" metric={{ name: 'up', type: 'gauge' }} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each<[MetricRow['type'], string]>([
    ['counter', 'Counter'],
    ['gauge', 'Gauge'],
    ['histogram', 'Histogram'],
    ['native histogram', 'Native histogram'],
    ['summary', 'Summary'],
    ['unknown', 'Unknown'],
  ])('labels a %s metric as "%s"', (type, label) => {
    render(<MetricMetadataBlock metricName="metric_name" metric={{ name: 'metric_name', type }} onClose={jest.fn()} />);

    expect(screen.getByTestId('signal-explorer-metric-type-badge')).toHaveTextContent(label);
  });

  // A light badge colour with the theme's default max-contrast foreground produced unreadable white
  // -on-pastel text. Every badge must clear WCAG AA for small bold text in BOTH themes, so the
  // foreground has to be derived from the background rather than fixed.
  describe('badge contrast', () => {
    const TYPES: MetricType[] = ['counter', 'gauge', 'histogram', 'native histogram', 'summary', 'unknown'];

    it.each(['dark', 'light'] as const)('clears WCAG AA on every type in the %s theme', (colorMode) => {
      const theme = createTheme({ colors: { mode: colorMode } });

      for (const type of TYPES) {
        const background = getMetricTypeBadgeColor(theme, type);
        const ratio = colorManipulator.getContrastRatio(
          theme.colors.getContrastText(background),
          background,
          theme.colors.background.primary
        );
        expect({ type, ratio: Math.round(ratio * 100) / 100 }).toEqual({
          type,
          ratio: expect.any(Number),
        });
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('gives each metric type its own colour, so the badge is not ambiguous', () => {
      const theme = createTheme();
      const colors = TYPES.map((type) => getMetricTypeBadgeColor(theme, type));

      expect(new Set(colors).size).toBe(TYPES.length);
    });
  });

  // Each type is visually distinguishable in the design, so the badge carries its type rather than
  // relying on colour alone reaching the DOM.
  it('marks the badge with the metric type it is colouring', () => {
    render(<MetricMetadataBlock metricName="c" metric={{ name: 'c', type: 'native histogram' }} onClose={jest.fn()} />);

    expect(screen.getByTestId('signal-explorer-metric-type-badge')).toHaveAttribute(
      'data-metric-type',
      'native histogram'
    );
  });
});
