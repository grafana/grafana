import { render, screen, within } from '@testing-library/react';

import {
  createTheme,
  type DataFrame,
  type FieldConfig,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  toDataFrame,
  VizOrientation,
} from '@grafana/data';
import { BigValueColorMode, BigValueGraphMode, PercentChangeColorMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { getChangeTone } from './StatFigures';
import { StatPanel } from './StatPanel';
import { defaultOptions, type Options, StatPresentation } from './panelcfg.gen';

const figureOptions: Options = {
  ...defaultOptions,
  presentation: StatPresentation.Figure,
  reduceOptions: { calcs: ['lastNotNull'], values: false },
  orientation: VizOrientation.Auto,
  graphMode: BigValueGraphMode.None,
  colorMode: BigValueColorMode.None,
  text: {},
} as Options;

function makeFrame(values: number[], config: FieldConfig = {}, name = 'Requests'): DataFrame {
  return toDataFrame({
    fields: [{ name, type: FieldType.number, values, config }],
  });
}

function renderFigures(series: DataFrame[], overrides: Partial<Options> = {}) {
  const props = getPanelProps<Options>(
    { ...figureOptions, ...overrides },
    {
      data: { state: LoadingState.Done, series, timeRange: getDefaultTimeRange() },
      fieldConfig: { defaults: {}, overrides: [] },
      replaceVariables: (v: string) => v,
      width: 600,
      height: 200,
    }
  );
  return render(<StatPanel {...props} />);
}

/** jsdom cannot compute `var()` colours, so read the last `color` declaration from the element's Emotion rules. */
function getEmotionColor(element: HTMLElement): string | undefined {
  const rules = Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules, (rule) => rule.cssText.replace(/\s*([{};:])\s*/g, '$1')))
    .join('');
  const declarations = Array.from(element.classList).flatMap((className) => {
    const body = rules.match(new RegExp(`\\.${className}\\{([^}]*)\\}`))?.[1] ?? '';
    return Array.from(body.matchAll(/(?:^|;)color:([^;]+)/g), (match) => match[1]);
  });
  return declarations.at(-1);
}

describe('StatPanel figure presentation', () => {
  it('renders one labelled figure group per value', () => {
    renderFigures([makeFrame([1, 2, 42], {}, 'Requests'), makeFrame([5, 7], {}, 'Errors')]);

    const groups = screen.getAllByRole('group');
    expect(groups).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Requests: 42' })).toHaveTextContent('Requests42');
    expect(screen.getByRole('group', { name: 'Errors: 7' })).toHaveTextContent('Errors7');
  });

  it('splits the unit from the number', () => {
    renderFigures([makeFrame([120], { unit: 'ms' }, 'Latency')]);

    const figure = screen.getByRole('group', { name: 'Latency: 120 ms' });
    const value = within(figure).getByTestId('stat-figure-value');
    expect(within(value).getByText('120')).toBeInTheDocument();
    expect(within(value).getByText('ms', { exact: false }).textContent).toBe('\u2009ms');
  });

  it('splits a currency prefix from the number', () => {
    renderFigures([makeFrame([25], { unit: 'currencyUSD', decimals: 0 }, 'Revenue')]);

    const value = screen.getByTestId('stat-figure-value');
    expect(within(value).getByText('25')).toBeInTheDocument();
    expect(within(value).getByText('$', { exact: false }).textContent).toBe('$\u2009');
  });

  it('omits the change line unless percent change is enabled', () => {
    renderFigures([makeFrame([100, 112.4])]);

    expect(screen.queryByText(/vs start of range/)).not.toBeInTheDocument();
  });

  it.each([
    { values: [100, 112.4], arrow: '▲', change: '12.4%', name: 'Requests: 112, up 12.4% vs start of range' },
    { values: [100, 96.9], arrow: '▼', change: '3.1%', name: 'Requests: 96.9, down 3.1% vs start of range' },
    { values: [100, 100], arrow: '—', change: '0%', name: 'Requests: 100, unchanged vs start of range' },
  ])('renders a $arrow $change change with an accessible description', ({ values, arrow, change, name }) => {
    renderFigures([makeFrame(values)], { showPercentChange: true });

    const figure = screen.getByRole('group', { name });
    expect(within(figure).getByText(/vs start of range/)).toHaveTextContent(`${arrow} ${change} vs start of range`);
  });

  it('shows the field description as a caption', () => {
    renderFigures([makeFrame([3], { description: 'Across all regions' })]);

    expect(within(screen.getByRole('group')).getByText('Across all regions')).toBeInTheDocument();
  });

  it('does not render a caption without a field description', () => {
    renderFigures([makeFrame([3])]);

    expect(screen.getByRole('group').children).toHaveLength(2);
  });

  it.each([
    { values: [100, 96.9], mode: PercentChangeColorMode.Standard, colour: 'bad' },
    { values: [100, 112.4], mode: PercentChangeColorMode.Inverted, colour: 'bad' },
    { values: [100, 112.4], mode: PercentChangeColorMode.Standard, colour: 'muted' },
    { values: [100, 96.9], mode: PercentChangeColorMode.Inverted, colour: 'muted' },
  ])('colours a $values change in $mode mode as $colour', ({ values, mode, colour }) => {
    const theme = createTheme();
    renderFigures([makeFrame(values)], { showPercentChange: true, percentChangeColorMode: mode });

    const expected =
      colour === 'bad'
        ? `var(--dash-bad, ${theme.colors.error.text})`
        : `var(--dash-muted, ${theme.colors.text.secondary})`;
    expect(getEmotionColor(screen.getByText(/vs start of range/))).toBe(expected);
  });
});

describe('getChangeTone', () => {
  it.each([
    { percentChange: 5, mode: PercentChangeColorMode.Standard, tone: 'good' },
    { percentChange: -5, mode: PercentChangeColorMode.Standard, tone: 'bad' },
    { percentChange: 5, mode: undefined, tone: 'good' },
    { percentChange: -5, mode: undefined, tone: 'bad' },
    { percentChange: 5, mode: PercentChangeColorMode.Inverted, tone: 'bad' },
    { percentChange: -5, mode: PercentChangeColorMode.Inverted, tone: 'good' },
    { percentChange: 0, mode: PercentChangeColorMode.Standard, tone: 'good' },
    { percentChange: 0, mode: PercentChangeColorMode.Inverted, tone: 'good' },
    { percentChange: -5, mode: PercentChangeColorMode.SameAsValue, tone: 'value' },
  ])('treats $percentChange in $mode mode as $tone', ({ percentChange, mode, tone }) => {
    expect(getChangeTone(percentChange, mode)).toBe(tone);
  });
});
