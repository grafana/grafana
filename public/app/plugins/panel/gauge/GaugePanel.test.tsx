import { render, screen } from '@testing-library/react';

import {
  type DataFrame,
  type FieldConfigSource,
  FieldType,
  LoadingState,
  getDefaultTimeRange,
  getLinksSupplier,
  toDataFrame,
  VizOrientation,
} from '@grafana/data';
import { BarGaugeSizing } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { GaugePanel } from './GaugePanel';
import { defaultOptions, type Options } from './panelcfg.gen';

jest.mock('@grafana/ui/internal', () => ({
  ...jest.requireActual('@grafana/ui/internal'),
  RadialGauge: ({ neutral }: { neutral?: number }) => <div data-testid="radial-gauge" data-neutral={neutral} />,
}));

const defaultPanelOptions: Options = {
  ...defaultOptions,
  reduceOptions: { calcs: ['lastNotNull'], values: false },
  orientation: VizOrientation.Auto,
  sizing: BarGaugeSizing.Auto,
  text: {},
} as Options;

function createNumericFrame(values = [42], fieldConfig = {}): DataFrame {
  return toDataFrame({
    fields: [{ name: 'value', type: FieldType.number, values, config: fieldConfig }],
  });
}

function renderGaugePanel(optionsOverrides?: Partial<Options>, dataOverrides?: Partial<{ series: DataFrame[] }>) {
  const props = getPanelProps<Options>(
    { ...defaultPanelOptions, ...optionsOverrides },
    {
      data: {
        state: LoadingState.Done,
        series: [createNumericFrame()],
        timeRange: getDefaultTimeRange(),
        ...dataOverrides,
      },
      fieldConfig: { defaults: {}, overrides: [] } as FieldConfigSource,
      replaceVariables: (v: string) => v,
    }
  );
  return render(<GaugePanel {...props} />);
}

describe('GaugePanel', () => {
  it('renders a RadialGauge for numeric data', () => {
    renderGaugePanel();

    expect(screen.getByTestId('radial-gauge')).toBeInTheDocument();
  });

  it('passes the neutral value from the field config to the gauge', () => {
    renderGaugePanel(undefined, { series: [createNumericFrame([42], { custom: { neutral: 25 } })] });

    expect(screen.getByTestId('radial-gauge')).toHaveAttribute('data-neutral', '25');
  });

  it('does not set a neutral value when the field config has none', () => {
    renderGaugePanel();

    expect(screen.getByTestId('radial-gauge')).not.toHaveAttribute('data-neutral');
  });

  it('shows the error view when there is no data', () => {
    renderGaugePanel(undefined, { series: [] });

    expect(screen.queryByTestId('radial-gauge')).not.toBeInTheDocument();
    expect(screen.getByText(/Unable to render/i)).toBeInTheDocument();
  });

  it('renders when the field uses percent units (auto min/max range branch)', () => {
    renderGaugePanel(undefined, { series: [createNumericFrame([50], { unit: 'percent' })] });

    expect(screen.getByTestId('radial-gauge')).toBeInTheDocument();
  });

  it('renders when the field uses percentunit units', () => {
    renderGaugePanel(undefined, { series: [createNumericFrame([0.5], { unit: 'percentunit' })] });

    expect(screen.getByTestId('radial-gauge')).toBeInTheDocument();
  });

  it('wraps the gauge in a data-links menu button when the field has multiple links', () => {
    const frameWithLinks = createNumericFrame([42], {
      links: [
        { title: 'Go', url: 'https://example.com' },
        { title: 'Explore', url: 'https://example.com/explore' },
      ],
    });
    const valueField = frameWithLinks.fields[0];
    valueField.getLinks = getLinksSupplier(frameWithLinks, valueField, {}, (v) => v);

    renderGaugePanel(undefined, { series: [frameWithLinks] });

    expect(screen.getByTestId('radial-gauge')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /data links/i })).toBeInTheDocument();
  });
});
