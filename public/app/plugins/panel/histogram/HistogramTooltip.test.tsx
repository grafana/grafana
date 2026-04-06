import { render, screen } from '@testing-library/react';

import { createDataFrame, createTheme, FieldType, getDisplayProcessor } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { HistogramTooltip } from './HistogramTooltip';

const theme = createTheme();

describe('HistogramTooltip', () => {
  const series = createSeriesFrame();
  const xMinOnlyFrame = createXMinOnlyFrame();

  it('renders', () => {
    render(
      <HistogramTooltip
        series={series}
        xMinOnlyFrame={xMinOnlyFrame}
        dataIdxs={[0, 0]}
        mode={TooltipDisplayMode.Multi}
        isPinned={false}
      />
    );

    expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
    expect(screen.getByText('count')).toBeVisible();
    expect(screen.getByText('5')).toBeVisible();
  });
  it('renders bucket range in header for first bucket', () => {
    render(<HistogramTooltip series={series} xMinOnlyFrame={xMinOnlyFrame} dataIdxs={[0, 0]} isPinned={false} />);

    expect(screen.getByText('Bucket')).toBeVisible();
    expect(screen.getByText('0 - 1')).toBeVisible();
  });

  it('renders bucket range for different bucket index', () => {
    render(<HistogramTooltip series={series} xMinOnlyFrame={xMinOnlyFrame} dataIdxs={[2, 2]} isPinned={false} />);
    expect(screen.getByText('2 - 3')).toBeVisible();
  });

  it('renders count value in content when seriesIdx matches count field (Single mode)', () => {
    render(
      <HistogramTooltip
        series={series}
        xMinOnlyFrame={xMinOnlyFrame}
        dataIdxs={[0, 0]}
        seriesIdx={1}
        mode={TooltipDisplayMode.Single}
        isPinned={false}
      />
    );

    expect(screen.getByText('Bucket')).toBeVisible();
    expect(screen.getByText('0 - 1')).toBeVisible();
    expect(screen.getByText('count')).toBeVisible();
    expect(screen.getByText('5')).toBeVisible();
  });

  it('does not show count when seriesIdx does not match count field in Single mode', () => {
    render(
      <HistogramTooltip
        series={series}
        xMinOnlyFrame={xMinOnlyFrame}
        dataIdxs={[0, 0]}
        seriesIdx={0}
        mode={TooltipDisplayMode.Single}
        isPinned={false}
      />
    );

    expect(screen.getByText('Bucket')).toBeVisible();
    expect(screen.getByText('0 - 1')).toBeVisible();
    expect(screen.queryByText('count')).toBeNull();
    expect(screen.queryByText('5')).toBeNull();
  });

  it('renders VizTooltipFooter when isPinned is true and seriesIdx is set', () => {
    render(
      <HistogramTooltip series={series} xMinOnlyFrame={xMinOnlyFrame} dataIdxs={[0, 0]} seriesIdx={1} isPinned={true} />
    );

    const wrapper = screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper);
    expect(wrapper).toBeVisible();
    expect(screen.getByText('count')).toBeVisible();
    expect(screen.getByText('5')).toBeVisible();
    // Footer is only rendered when isPinned: wrapper has 3 children (header, content, footer)
    expect(wrapper.children).toHaveLength(3);
  });

  it('does not render VizTooltipFooter when isPinned is false', () => {
    render(
      <HistogramTooltip
        series={series}
        xMinOnlyFrame={xMinOnlyFrame}
        dataIdxs={[0, 0]}
        seriesIdx={1}
        isPinned={false}
      />
    );

    const wrapper = screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper);
    expect(wrapper).toBeVisible();
    expect(screen.getByText('count')).toBeVisible();
    expect(screen.getByText('5')).toBeVisible();
    // Footer is not rendered when isPinned: wrapper has 2 children (header, content)
    expect(wrapper.children).toHaveLength(2);
  });

  it('renders all count values in Multi mode', () => {
    render(
      <HistogramTooltip
        series={series}
        xMinOnlyFrame={xMinOnlyFrame}
        dataIdxs={[0, 0]}
        mode={TooltipDisplayMode.Multi}
        isPinned={false}
      />
    );

    expect(screen.getByText('5')).toBeVisible();
  });

  it('accepts mode and sortOrder props', () => {
    render(
      <HistogramTooltip
        series={series}
        xMinOnlyFrame={xMinOnlyFrame}
        dataIdxs={[0, 0]}
        mode={TooltipDisplayMode.Multi}
        sortOrder={SortOrder.Ascending}
        isPinned={false}
      />
    );

    expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
    expect(screen.getByText('count')).toBeVisible();
    expect(screen.getByText('5')).toBeVisible();
  });

  it('accepts maxHeight prop for scrollable tooltip', () => {
    render(
      <HistogramTooltip
        series={series}
        xMinOnlyFrame={xMinOnlyFrame}
        dataIdxs={[0, 0]}
        mode={TooltipDisplayMode.Multi}
        maxHeight={200}
        isPinned={false}
      />
    );

    expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
    expect(screen.getByText('count')).toBeVisible();
    expect(screen.getByText('5')).toBeVisible();
  });
});

function stampFrameWithDisplay(frame: ReturnType<typeof createDataFrame>): ReturnType<typeof createDataFrame> {
  frame.fields.forEach((field) => {
    if (!field.display) {
      field.display = getDisplayProcessor({ field, theme });
    }
  });
  return frame;
}

function createSeriesFrame() {
  return stampFrameWithDisplay(
    createDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.number, values: [0, 1, 2, 3] },
        { name: 'xMax', type: FieldType.number, values: [1, 2, 3, 4] },
        { name: 'count', type: FieldType.number, values: [5, 10, 15, 20], config: {} },
      ],
    })
  );
}

function createXMinOnlyFrame() {
  return stampFrameWithDisplay(
    createDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.number, values: [0, 1, 2, 3] },
        { name: 'count', type: FieldType.number, values: [5, 10, 15, 20], config: {} },
      ],
    })
  );
}
