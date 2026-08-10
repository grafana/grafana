import { render } from '@testing-library/react';

import { createTheme, type Field, FieldType } from '@grafana/data';

import { buildHeaderHistogramConfig, HeaderMiniChart } from './HeaderMiniChart';

jest.mock('../../../uPlot/Plot', () => ({
  UPlotChart: ({ width, height }: { width: number; height: number }) => (
    <div data-mocked-uplot="" data-width={width} data-height={height} />
  ),
}));

function makeField(overrides: Partial<Field> = {}): Field {
  return {
    name: 'value',
    type: FieldType.number,
    values: [],
    config: {},
    ...overrides,
  };
}

describe('HeaderMiniChart', () => {
  it('builds a stripped histogram config with hidden axes, cursor, and points', () => {
    const config = buildHeaderHistogramConfig(
      {
        kind: 'histogram',
        x: [0, 1, 2],
        counts: [1, 3, 2],
        min: 0,
        max: 2,
        nullCount: 0,
        invalidCount: 0,
        totalCount: 6,
      },
      createTheme()
    ).getConfig();

    expect(config.cursor).toMatchObject({ show: false, x: false, y: false });
    expect(config.axes).toEqual([
      expect.objectContaining({ show: false, size: 0 }),
      expect.objectContaining({ show: false, size: 0 }),
    ]);
    expect(config.series[1]).toEqual(
      expect.objectContaining({
        scale: 'count',
        width: 0,
        stroke: '#6B727C',
        fill: '#6B727C',
        points: expect.objectContaining({ show: false }),
      })
    );
  });

  it('sizes the uPlot histogram to the available header width', () => {
    const { container } = render(
      <HeaderMiniChart
        distribution={{
          kind: 'histogram',
          x: [0, 1],
          counts: [1, 2],
          min: 0,
          max: 1,
          nullCount: 0,
          invalidCount: 0,
          totalCount: 3,
        }}
        field={makeField()}
        width={137}
      />
    );

    expect(container.querySelector('[data-mocked-uplot]')).toHaveAttribute('data-width', '137');
    expect(container.querySelector('[data-mocked-uplot]')).toHaveAttribute('data-height', '30');
    expect(container.querySelector('[data-table-header-visualization]')).toHaveStyle({
      boxSizing: 'border-box',
      height: '52px',
      maxWidth: '100%',
      paddingBlock: '2px',
    });
    expect(container.querySelector('[data-header-histogram-content]')).toHaveStyle({
      display: 'flex',
      gap: '4px',
      width: '100%',
    });
  });

  it('formats histogram endpoints with the field display processor', () => {
    const display = jest.fn((value: unknown) => ({
      text: `${value} ms`,
      numeric: value as number,
    }));
    render(
      <HeaderMiniChart
        distribution={{
          kind: 'histogram',
          x: [1000, 2000],
          counts: [1, 1],
          min: 1000,
          max: 2000,
          nullCount: 0,
          invalidCount: 0,
          totalCount: 2,
        }}
        field={makeField({ type: FieldType.time, display })}
        width={137}
      />
    );

    expect(display).toHaveBeenCalledWith(1000);
    expect(display).toHaveBeenCalledWith(2000);
    expect(document.querySelector('[data-histogram-endpoint="start"]')).toHaveTextContent('1000 ms');
    expect(document.querySelector('[data-histogram-endpoint="end"]')).toHaveTextContent('2000 ms');
    expect(document.querySelector('[data-histogram-endpoint="start"]')).toHaveStyle({ textAlign: 'left' });
    expect(document.querySelector('[data-histogram-endpoint="end"]')).toHaveStyle({ textAlign: 'right' });
  });

  it('renders labels inside sufficiently wide categorical segments', () => {
    const { container } = render(
      <HeaderMiniChart
        distribution={{
          kind: 'categories',
          segments: [
            { label: 'Success', count: 3, type: 'value' },
            { label: 'Other', count: 2, type: 'other' },
            { label: 'Null', count: 1, type: 'null' },
          ],
          totalCount: 6,
        }}
        field={makeField({ type: FieldType.string })}
        width={120}
      />
    );

    const segments = container.querySelectorAll('[data-segment-label]');
    expect(Array.from(segments).map((segment) => segment.getAttribute('data-segment-label'))).toEqual([
      'Success',
      'Other',
      'Null',
    ]);
    expect(Array.from(segments).map((segment) => segment.getAttribute('data-segment-count'))).toEqual(['3', '2', '1']);
    expect(Array.from(segments).map((segment) => (segment as HTMLElement).style.flexGrow)).toEqual(['3', '2', '1']);
    expect(Array.from(segments).map((segment) => segment.textContent)).toEqual(['Success', 'Other', '']);
    expect(Array.from(segments).map((segment) => segment.getAttribute('data-segment-label-visible'))).toEqual([
      'true',
      'true',
      'false',
    ]);
  });

  it('omits category text when every segment is too narrow', () => {
    const { container } = render(
      <HeaderMiniChart
        distribution={{
          kind: 'categories',
          segments: [
            { label: 'Alpha', count: 1, type: 'value' },
            { label: 'Beta', count: 1, type: 'value' },
          ],
          totalCount: 2,
        }}
        field={makeField({ type: FieldType.string })}
        width={50}
      />
    );

    expect(
      Array.from(container.querySelectorAll('[data-segment-label]')).map((segment) => segment.textContent)
    ).toEqual(['', '']);
    expect(container.querySelector('[data-table-header-visualization]')).toHaveStyle({
      overflow: 'hidden',
      pointerEvents: 'none',
    });
  });

  it('does not initialize a chart at zero width', () => {
    const { container } = render(
      <HeaderMiniChart
        distribution={{
          kind: 'categories',
          segments: [{ label: 'value', count: 1, type: 'value' }],
          totalCount: 1,
        }}
        field={makeField({ type: FieldType.string })}
        width={0}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
