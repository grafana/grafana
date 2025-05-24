import { render, prettyDOM, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Provider } from 'react-redux';

import { DataFrame, TimeRange } from '@grafana/data';
import { DataSourceSrv, setDataSourceSrv, setPluginLinksHook } from '@grafana/runtime';

import { configureStore } from '../../../store/configureStore';

import { TraceView } from './TraceView';
import { frameOld, frameNew } from './utils/test-mocks';
import { transformDataFrames } from './utils/transform';

function getTraceView(frames: DataFrame[]) {
  const store = configureStore();
  const topOfViewRef = createRef<HTMLDivElement>();

  return (
    <Provider store={store}>
      <TraceView
        exploreId="left"
        dataFrames={frames}
        splitOpenFn={() => {}}
        traceProp={transformDataFrames(frames[0])!}
        datasource={undefined}
        topOfViewRef={topOfViewRef}
        timeRange={{} as TimeRange}
      />
    </Provider>
  );
}

function renderTraceView(frames = [frameOld]) {
  const { container, baseElement } = render(getTraceView(frames));

  return {
    header: container.children[0],
    timeline: container.children[1],
    container,
    baseElement,
  };
}

function renderTraceViewNew() {
  return renderTraceView([frameNew]);
}

describe('TraceView', () => {
  beforeAll(() => {
    setPluginLinksHook(() => ({
      isLoading: false,
      links: [],
    }));

    setDataSourceSrv({
      getInstanceSettings() {
        return undefined;
      },
    } as DataSourceSrv);
  });

  it('renders TraceTimelineViewer', () => {
    const { timeline, header } = renderTraceView();
    expect(timeline).toBeDefined();
    expect(header).toBeDefined();
  });

  it('renders TraceTimelineViewer with new format', () => {
    const { timeline, header } = renderTraceViewNew();
    expect(timeline).toBeDefined();
    expect(header).toBeDefined();
  });

  it('renders renders the same for old and new format', () => {
    const { baseElement } = renderTraceViewNew();
    const { baseElement: baseElementOld } = renderTraceView();
    expect(prettyDOM(baseElement)).toEqual(prettyDOM(baseElementOld));
  });

  it('only renders noDataMsg on missing trace', () => {
    // Simulating Explore's access to empty response data
    const { container } = renderTraceView([]);
    expect(container.childNodes.length === 1).toBeTruthy();
  });

  it('toggles detailState', async () => {
    renderTraceViewNew();
    expect(screen.queryByText(/Span attributes/)).toBeFalsy();
    const spanView = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[0];
    await userEvent.click(spanView);
    expect(screen.queryByText(/Span attributes/)).toBeTruthy();

    await userEvent.click(spanView);
    screen.debug(screen.queryAllByText(/Span attributes/));
    expect(screen.queryByText(/Span attributes/)).toBeFalsy();
  });

  it('shows timeline ticks', () => {
    renderTraceViewNew();
    function ticks() {
      return screen.getByText('', { selector: 'div[data-testid="TimelineHeaderRow"]' }).children[1].children[1]
        .textContent;
    }
    expect(ticks()).toBe('0μs274.5μs549μs823.5μs1.1ms');
  });

  it('correctly shows processes for each span', async () => {
    renderTraceView();
    let table: HTMLElement;
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);

    const firstSpan = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[0];
    await userEvent.click(firstSpan);
    await userEvent.click(screen.getByText(/Resource/));
    table = screen.getByText('', { selector: 'div[data-testid="KeyValueTable"]' });
    expect(table.innerHTML).toContain('client-uuid-1');
    await userEvent.click(firstSpan);

    const secondSpan = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[1];
    await userEvent.click(secondSpan);
    await userEvent.click(screen.getByText(/Resource/));
    table = screen.getByText('', { selector: 'div[data-testid="KeyValueTable"]' });
    expect(table.innerHTML).toContain('client-uuid-2');
    await userEvent.click(secondSpan);

    const thirdSpan = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[2];
    await userEvent.click(thirdSpan);
    await userEvent.click(screen.getByText(/Resource/));
    table = screen.getByText('', { selector: 'div[data-testid="KeyValueTable"]' });
    expect(table.innerHTML).toContain('client-uuid-3');
  });

  it('resets detail view for new trace with the identical spanID', async () => {
    const { rerender } = render(getTraceView([frameOld]));
    const span = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[2];
    await userEvent.click(span);
    //Process is in detail view
    expect(screen.getByText(/Resource/)).toBeInTheDocument();

    rerender(getTraceView([frameNew]));
    expect(screen.queryByText(/Resource/)).not.toBeInTheDocument();
  });
});
