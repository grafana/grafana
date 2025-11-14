import { render, screen } from '@testing-library/react';
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

  it('renders next/prev result buttons', async () => {
    renderTraceViewContainer();

    const nextResultButton = screen.getByRole('button', { name: 'Next result button' });
    const prevResultButton = screen.getByRole('button', { name: 'Prev result button' });

    // Buttons should be disabled when there are no filters applied
    expect(nextResultButton).toBeDisabled();
    expect(prevResultButton).toBeDisabled();
    expect(nextResultButton.getAttribute('tabindex')).toBe('-1');
    expect(prevResultButton.getAttribute('tabindex')).toBe('-1');
  });

  it('renders show all spans switch', async () => {
    renderTraceViewContainer();

    // Find the show all spans switch in the search bar
    const matchesSwitch = await screen.findByRole('switch', { name: 'Show all spans' });
    expect(matchesSwitch).toBeInTheDocument();
    // Switch should be checked (showing all spans) and disabled by default (no filters)
    expect(matchesSwitch).toBeChecked();
    expect(matchesSwitch).toBeDisabled();
  });
});
