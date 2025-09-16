import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';

import { TimeRange } from '@grafana/data';

import { configureStore } from '../../../store/configureStore';
import { initialExploreState } from '../state/main';
import { makeExplorePaneState } from '../state/utils';

// TODO: rebase after https://github.com/grafana/grafana/pull/105711, as this is already fixed
// eslint-disable-next-line no-restricted-imports
import { frameOld } from './TraceView.test';
import { TraceViewContainer } from './TraceViewContainer';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
    usePluginLinks: jest.fn().mockReturnValue({ isLoading: false, links: [] }),
  };
});

function renderTraceViewContainer(frames = [frameOld]) {
  const initialState = {
    explore: {
      ...initialExploreState,
      panes: {
        left: makeExplorePaneState({
          initialized: true,
          datasourceInstance: null,
        }),
      },
    },
  };

  const store = configureStore(initialState);

  const { container, baseElement } = render(
    <Provider store={store}>
      <TraceViewContainer exploreId="left" dataFrames={frames} splitOpenFn={() => {}} timeRange={{} as TimeRange} />
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
    user = userEvent.setup();
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
    await user.click(screen.getByLabelText('Collapse all'));
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(1);
    await user.click(screen.getByLabelText('Expand all'));
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
  });

  it('can select next/prev results', async () => {
    renderTraceViewContainer();
    const spanFiltersButton = screen.getByRole('button', { name: 'Span Filters 3 spans Prev Next' });
    await user.click(spanFiltersButton);

    const nextResultButton = screen.getByRole('button', { name: 'Next result button' });
    const prevResultButton = screen.getByRole('button', { name: 'Prev result button' });
    expect(nextResultButton.getAttribute('tabindex')).toBe('-1');
    expect(prevResultButton.getAttribute('tabindex')).toBe('-1');

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

    expect(nextResultButton.getAttribute('tabindex')).toBe('0');
    expect(prevResultButton.getAttribute('tabindex')).toBe('0');
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
    renderTraceViewContainer();
    const spanFiltersButton = screen.getByRole('button', { name: 'Span Filters 3 spans Prev Next' });
    await user.click(spanFiltersButton);

    await user.click(screen.getByLabelText('Select tag key'));
    const tagOption = screen.getByText('http.status_code');
    await waitFor(() => expect(tagOption).toBeInTheDocument());
    await user.click(tagOption);

    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
    const matchesSwitch = screen.getByRole('switch', { name: 'Show matches only switch' });
    expect(matchesSwitch).toBeInTheDocument();
    await user.click(matchesSwitch);
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(1);
  });
});
