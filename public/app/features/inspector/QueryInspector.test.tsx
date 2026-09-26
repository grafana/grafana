import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Subject } from 'rxjs';

import { getDefaultTimeRange, LoadingState, type PanelData } from '@grafana/data';
import { backendSrv, type InspectorStream } from 'app/core/services/backend_srv';

import { QueryInspector } from './QueryInspector';

const doneData = (): PanelData => ({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });

const inspectorEvent = (requestId: string, data: {}): InspectorStream => ({
  requestId,
  response: {
    status: 200,
    statusText: 'OK',
    ok: true,
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    data,
    config: { url: '' },
  },
});

// The default open depth is 3 (response > data > level1), so `level2` starts collapsed.
const nestedData = { level1: { level2: { level3: 'deep value' } } };

const rowForKey = (key: string) => screen.getByText(`${key}:`).closest('.json-formatter-row')!;

describe('QueryInspector', () => {
  let inspectorStream: Subject<InspectorStream>;

  beforeEach(() => {
    inspectorStream = new Subject();
    jest.spyOn(backendSrv, 'getInspectorStream').mockReturnValue(inspectorStream);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the response of requests made by its own instance only', () => {
    render(<QueryInspector instanceId="explore-left" data={doneData()} onRefreshQuery={jest.fn()} />);

    act(() => {
      inspectorStream.next(inspectorEvent('explore-right-A', { fromOtherPane: 1 }));
      inspectorStream.next(inspectorEvent('explore-left-A', nestedData));
    });

    expect(screen.getByText('level1:')).toBeInTheDocument();
    expect(screen.queryByText('fromOtherPane:')).not.toBeInTheDocument();
  });

  // Known bug: `onDidRender` is an inline arrow, so every QueryInspector render gets past JSONFormatter's
  // memo and rebuilds the tree at the default depth. Any re-render (a streaming panel's data emission, an
  // Explore state change) collapses nodes the user expanded. Change to `it` once fixed.
  it.failing('keeps nodes the user expanded when it re-renders with new data', async () => {
    const onRefreshQuery = jest.fn();
    const { rerender } = render(<QueryInspector data={doneData()} onRefreshQuery={onRefreshQuery} />);
    act(() => {
      inspectorStream.next(inspectorEvent('A', nestedData));
    });

    await userEvent.click(rowForKey('level2').querySelector('.json-formatter-toggler-link')!);
    expect(rowForKey('level2')).toHaveClass('json-formatter-open');

    rerender(<QueryInspector data={doneData()} onRefreshQuery={onRefreshQuery} />);

    expect(rowForKey('level2')).toHaveClass('json-formatter-open');
  });
});
