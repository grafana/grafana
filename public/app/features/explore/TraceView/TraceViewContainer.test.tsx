import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';

import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { ExploreId } from 'app/types';

import { configureStore } from '../../../store/configureStore';

import { frameOld } from './TraceView.test';
import { TraceViewContainer } from './TraceViewContainer';

function renderTraceViewContainer(frames = [frameOld]) {
  const store = configureStore();
  const mockPanelData = {
    state: LoadingState.Done,
    series: [],
    timeRange: getDefaultTimeRange(),
  };

  const { container, baseElement } = render(
    <Provider store={store}>
      <TraceViewContainer
        exploreId={ExploreId.left}
        dataFrames={frames}
        splitOpenFn={() => {}}
        queryResponse={mockPanelData}
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
  it('toggles children visibility', () => {
    renderTraceViewContainer();
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
    userEvent.click(screen.getAllByText('', { selector: 'span[data-test-id="SpanTreeOffset--indentGuide"]' })[0]);
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(1);

    userEvent.click(screen.getAllByText('', { selector: 'span[data-test-id="SpanTreeOffset--indentGuide"]' })[0]);
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
  });

  it('toggles collapses and expands one level of spans', () => {
    renderTraceViewContainer();
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
    userEvent.click(screen.getByLabelText('Collapse +1'));
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(2);
    userEvent.click(screen.getByLabelText('Expand +1'));
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
  });

  it('toggles collapses and expands all levels', () => {
    renderTraceViewContainer();
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
    userEvent.click(screen.getByLabelText('Collapse All'));
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(1);
    userEvent.click(screen.getByLabelText('Expand All'));
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
  });

  it('searches for spans', () => {
    renderTraceViewContainer();
    userEvent.type(screen.getByPlaceholderText('Find...'), '1ed38015486087ca');
    expect(
      (screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' })[0].parentNode! as HTMLElement).className
    ).toContain('rowMatchingFilter');
  });

  it('can select next/prev results', () => {
    renderTraceViewContainer();
    userEvent.type(screen.getByPlaceholderText('Find...'), 'logproto');
    const nextResultButton = screen.getByTestId('trace-page-search-bar-next-result-button');
    const prevResultButton = screen.getByTestId('trace-page-search-bar-prev-result-button');
    const suffix = screen.getByTestId('trace-page-search-bar-suffix');

    userEvent.click(nextResultButton);
    expect(suffix.textContent).toBe('1 of 2');
    expect(
      (screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' })[1].parentNode! as HTMLElement).className
    ).toContain('rowFocused');
    userEvent.click(nextResultButton);
    expect(suffix.textContent).toBe('2 of 2');
    expect(
      (screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' })[2].parentNode! as HTMLElement).className
    ).toContain('rowFocused');
    userEvent.click(nextResultButton);
    expect(suffix.textContent).toBe('1 of 2');
    expect(
      (screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' })[1].parentNode! as HTMLElement).className
    ).toContain('rowFocused');
    userEvent.click(prevResultButton);
    expect(suffix.textContent).toBe('2 of 2');
    expect(
      (screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' })[2].parentNode! as HTMLElement).className
    ).toContain('rowFocused');
    userEvent.click(prevResultButton);
    expect(suffix.textContent).toBe('1 of 2');
    expect(
      (screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' })[1].parentNode! as HTMLElement).className
    ).toContain('rowFocused');
    userEvent.click(prevResultButton);
    expect(suffix.textContent).toBe('2 of 2');
    expect(
      (screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' })[2].parentNode! as HTMLElement).className
    ).toContain('rowFocused');
  });
});
