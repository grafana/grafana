import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { createRef } from 'react';
import { Provider } from 'react-redux';

import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { config } from '@grafana/runtime';

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
        exploreId="left"
        dataFrames={frames}
        splitOpenFn={() => {}}
        queryResponse={mockPanelData}
        topOfViewRef={topOfViewRef}
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
  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('toggles children visibility', async () => {
    renderTraceViewContainer();
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
    await user.click(screen.getAllByText('', { selector: 'span[data-testid="SpanTreeOffset--indentGuide"]' })[0]);
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(1);

    await user.click(screen.getAllByText('', { selector: 'span[data-testid="SpanTreeOffset--indentGuide"]' })[0]);
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
  });

  it('toggles collapses and expands one level of spans', async () => {
    renderTraceViewContainer();
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
    await user.click(screen.getByLabelText('Collapse +1'));
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(2);
    await user.click(screen.getByLabelText('Expand +1'));
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
  });

  it('toggles collapses and expands all levels', async () => {
    renderTraceViewContainer();
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
    await user.click(screen.getByLabelText('Collapse All'));
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(1);
    await user.click(screen.getByLabelText('Expand All'));
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
  });

  it('searches for spans', async () => {
    renderTraceViewContainer();
    await user.type(screen.getByPlaceholderText('Find...'), '1ed38015486087ca');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[0].parentElement!.className
    ).toContain('rowMatchingFilter');
  });

  it('can select next/prev results', async () => {
    renderTraceViewContainer();
    await user.type(screen.getByPlaceholderText('Find...'), 'logproto');
    const nextResultButton = screen.getByRole('button', { name: 'Next results button' });
    const prevResultButton = screen.getByRole('button', { name: 'Prev results button' });
    const suffix = screen.getByLabelText('Search bar suffix');

    await user.click(nextResultButton);
    expect(suffix.textContent).toBe('1 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[1].parentElement!.className
    ).toContain('rowFocused');
    await user.click(nextResultButton);
    expect(suffix.textContent).toBe('2 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[2].parentElement!.className
    ).toContain('rowFocused');
    await user.click(nextResultButton);
    expect(suffix.textContent).toBe('1 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[1].parentElement!.className
    ).toContain('rowFocused');
    await user.click(prevResultButton);
    expect(suffix.textContent).toBe('2 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[2].parentElement!.className
    ).toContain('rowFocused');
    await user.click(prevResultButton);
    expect(suffix.textContent).toBe('1 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[1].parentElement!.className
    ).toContain('rowFocused');
    await user.click(prevResultButton);
    expect(suffix.textContent).toBe('2 of 2');
    expect(
      screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[2].parentElement!.className
    ).toContain('rowFocused');
  });

  it('can select next/prev results', async () => {
    config.featureToggles.newTraceViewHeader = true;
    renderTraceViewContainer();
    const spanFiltersButton = screen.getByRole('button', { name: 'Span Filters' });
    await user.click(spanFiltersButton);

    const nextResultButton = screen.getByRole('button', { name: 'Next result button' });
    const prevResultButton = screen.getByRole('button', { name: 'Prev result button' });
    expect((nextResultButton as HTMLButtonElement)['disabled']).toBe(true);
    expect((prevResultButton as HTMLButtonElement)['disabled']).toBe(true);

    await user.click(screen.getByLabelText('Select tag key'));
    const tagOption = screen.getByText('component');
    await waitFor(() => expect(tagOption).toBeInTheDocument());
    await user.click(tagOption);

    await waitFor(() => {
      expect(
        screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[0].parentElement!.className
      ).toContain('rowMatchingFilter');
      expect(
        screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[1].parentElement!.className
      ).toContain('rowMatchingFilter');
      expect(
        screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[2].parentElement!.className
      ).toContain('rowMatchingFilter');
    });

    expect((nextResultButton as HTMLButtonElement)['disabled']).toBe(false);
    expect((prevResultButton as HTMLButtonElement)['disabled']).toBe(false);
    await user.click(nextResultButton);
    await waitFor(() => {
      expect(
        screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[0].parentElement!.className
      ).toContain('rowFocused');
    });
    await user.click(nextResultButton);
    await waitFor(() => {
      expect(
        screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[1].parentElement!.className
      ).toContain('rowFocused');
    });
    await user.click(prevResultButton);
    await waitFor(() => {
      expect(
        screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[0].parentElement!.className
      ).toContain('rowFocused');
    });
  });

  it('show matches only works as expected', async () => {
    config.featureToggles.newTraceViewHeader = true;
    renderTraceViewContainer();
    const spanFiltersButton = screen.getByRole('button', { name: 'Span Filters' });
    await user.click(spanFiltersButton);

    await user.click(screen.getByLabelText('Select tag key'));
    const tagOption = screen.getByText('http.status_code');
    await waitFor(() => expect(tagOption).toBeInTheDocument());
    await user.click(tagOption);

    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
    const matchesSwitch = screen.getByRole('checkbox', { name: 'Show matches only switch' });
    expect(matchesSwitch).toBeInTheDocument();
    await user.click(matchesSwitch);
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(1);
  });
});
