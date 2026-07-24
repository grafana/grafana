import { render, screen } from '@testing-library/react';

import {
  type DataFrame,
  type FieldConfigSource,
  FieldType,
  LoadingState,
  getDefaultTimeRange,
  toDataFrame,
  VizOrientation,
} from '@grafana/data';
import { BigValueGraphMode, BigValueTextMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { StatPanel } from './StatPanel';
import { defaultOptions, type Options } from './panelcfg.gen';

const defaultPanelOptions: Options = {
  ...defaultOptions,
  reduceOptions: { calcs: ['lastNotNull'], values: false },
  orientation: VizOrientation.Auto,
  text: {},
} as Options;

function createNumericFrame(values = [10, 20, 30], fieldOverrides = {}): DataFrame {
  return toDataFrame({
    fields: [{ name: 'value', type: FieldType.number, values, config: {}, ...fieldOverrides }],
  });
}

function renderStatPanel(
  optionsOverrides?: Partial<Options>,
  dataOverrides?: Partial<{ series: DataFrame[] }>,
  fieldConfig?: Partial<FieldConfigSource>,
  propOverrides?: Partial<{ title: string }>
) {
  const props = getPanelProps<Options>(
    { ...defaultPanelOptions, ...optionsOverrides },
    {
      data: {
        state: LoadingState.Done,
        series: [createNumericFrame()],
        timeRange: getDefaultTimeRange(),
        ...dataOverrides,
      },
      fieldConfig: { defaults: {}, overrides: [], ...fieldConfig } as FieldConfigSource,
      replaceVariables: (v: string) => v,
      ...propOverrides,
    }
  );
  return render(<StatPanel {...props} />);
}

describe('StatPanel', () => {
  it('renders the reduced value for numeric data', () => {
    renderStatPanel();

    // lastNotNull of [10, 20, 30]
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders the field name when textMode Auto resolves to ValueAndName via displayName', () => {
    // The getTextMode branch keys off the panel-level fieldConfig.defaults.displayName, while the
    // rendered title comes from the field's own config (overrides are applied upstream in real usage).
    const frame = createNumericFrame([10, 20, 30], { config: { displayName: 'My Metric' } });

    renderStatPanel(undefined, { series: [frame] }, { defaults: { displayName: 'My Metric' } });

    expect(screen.getByText('My Metric')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders without configured min/max by auto-calculating the numeric range', () => {
    // No min/max on the field config exercises the findNumericFieldMinMax branch in getValues.
    renderStatPanel(undefined, { series: [createNumericFrame([5, 15, 25])] });

    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('still renders the value when the field carries data links', () => {
    const frameWithLinks = createNumericFrame([42], {
      config: { links: [{ title: 'Go', url: 'https://example.com' }] },
    });

    renderStatPanel(undefined, { series: [frameWithLinks] });

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows the field name when textMode Auto resolves to ValueAndName because the panel has no title', () => {
    // Auto + empty title (and no displayName) is the second getTextMode branch → ValueAndName.
    const frame = createNumericFrame([10, 20, 30], { name: 'requests' });

    renderStatPanel({ textMode: BigValueTextMode.Auto }, { series: [frame] }, undefined, { title: '' });

    expect(screen.getByText('requests')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders no value text when textMode is None', () => {
    renderStatPanel({ textMode: BigValueTextMode.None });

    expect(screen.queryByText('30')).not.toBeInTheDocument();
  });

  it('renders a sparkline value when graphMode is Area', () => {
    // A time + number frame produces a sparkline, exercising the sparkline.timeRange branch.
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3], config: {} },
        { name: 'value', type: FieldType.number, values: [10, 20, 30], config: {} },
      ],
    });

    renderStatPanel({ graphMode: BigValueGraphMode.Area }, { series: [frame] });

    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders the value with percent change enabled', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3], config: {} },
        { name: 'value', type: FieldType.number, values: [10, 20, 30], config: {} },
      ],
    });

    renderStatPanel({ showPercentChange: true }, { series: [frame] });

    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders each row when reduceOptions.values is true', () => {
    renderStatPanel({ reduceOptions: { calcs: [], values: true } });

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });
});
