import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { createRef } from 'react';
import { Provider } from 'react-redux';

import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { ExploreId } from 'app/types';

import { configureStore } from '../../../store/configureStore';

import { frameOld } from './TraceView.test';
import { TraceViewContainer } from './TraceViewContainer';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});

function renderTraceViewContainer(frames = [frameOld]) {
  const store = configureStore();
  const mockPanelData = {
    state: LoadingState.Done,
    series: [],
    timeRange: getDefaultTimeRange(),
  };
  const topOfViewRef = createRef<HTMLDivElement>();

  const { container, baseElement } = render(
    <Provider store={store}>
      <TraceViewContainer
        exploreId={ExploreId.left}
        dataFrames={frames}
        splitOpenFn={() => {}}
        queryResponse={mockPanelData}
        topOfViewRef={topOfViewRef}
        width={300}
      />
    </Provider>
  );
  return {
    header: container.children[0],
    timeline: container.children[1],
    container,
    baseElement,
  };
}

describe('TraceViewContainer', () => {
  it('toggles children visibility', async () => {
    renderTraceViewContainer();
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
    await userEvent.click(screen.getAllByText('', { selector: 'span[data-testid="SpanTreeOffset--indentGuide"]' })[0]);
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(1);

    await userEvent.click(screen.getAllByText('', { selector: 'span[data-testid="SpanTreeOffset--indentGuide"]' })[0]);
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
  });

  it('toggles collapses and expands one level of spans', async () => {
    renderTraceViewContainer();
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
    await userEvent.click(screen.getByLabelText('Collapse +1'));
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(2);
    await userEvent.click(screen.getByLabelText('Expand +1'));
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
  });

  it('toggles collapses and expands all levels', async () => {
    renderTraceViewContainer();
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
    await userEvent.click(screen.getByLabelText('Collapse All'));
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(1);
    await userEvent.click(screen.getByLabelText('Expand All'));
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
  });

  it('searches for spans', async () => {
    renderTraceViewContainer();
    await userEvent.type(screen.getByPlaceholderText('Find...'), '1ed38015486087ca');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[0].parentElement!.className
    ).toContain('rowMatchingFilter');
  });

  it('can select next/prev results', async () => {
    renderTraceViewContainer();
    await userEvent.type(screen.getByPlaceholderText('Find...'), 'logproto');
    const nextResultButton = screen.getByRole('button', { name: 'Next results button' });
    const prevResultButton = screen.getByRole('button', { name: 'Prev results button' });
    const suffix = screen.getByLabelText('Search bar suffix');

    await userEvent.click(nextResultButton);
    expect(suffix.textContent).toBe('1 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[1].parentElement!.className
    ).toContain('rowFocused');
    await userEvent.click(nextResultButton);
    expect(suffix.textContent).toBe('2 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[2].parentElement!.className
    ).toContain('rowFocused');
    await userEvent.click(nextResultButton);
    expect(suffix.textContent).toBe('1 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[1].parentElement!.className
    ).toContain('rowFocused');
    await userEvent.click(prevResultButton);
    expect(suffix.textContent).toBe('2 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[2].parentElement!.className
    ).toContain('rowFocused');
    await userEvent.click(prevResultButton);
    expect(suffix.textContent).toBe('1 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[1].parentElement!.className
    ).toContain('rowFocused');
    await userEvent.click(prevResultButton);
    expect(suffix.textContent).toBe('2 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[2].parentElement!.className
    ).toContain('rowFocused');
  });
});
