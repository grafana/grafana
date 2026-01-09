import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import FlameGraphHeader from './FlameGraphHeader';
import { PaneView, SelectedView, ViewMode } from './types';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn().mockReturnValue({
    isAvailable: false,
    openAssistant: undefined,
  }),
  createAssistantContextItem: jest.fn(),
  OpenAssistantButton: () => <div>OpenAssistantButton</div>,
}));

describe('FlameGraphHeader', () => {
  function setup(props: Partial<React.ComponentProps<typeof FlameGraphHeader>> = {}) {
    const setSearch = jest.fn();
    const setSelectedView = jest.fn();
    const setViewMode = jest.fn();
    const setLeftPaneView = jest.fn();
    const setRightPaneView = jest.fn();
    const setSingleView = jest.fn();
    const onReset = jest.fn();

    const renderResult = render(
      <FlameGraphHeader
        search={''}
        setSearch={setSearch}
        selectedView={SelectedView.Both}
        setSelectedView={setSelectedView}
        viewMode={ViewMode.Split}
        setViewMode={setViewMode}
        leftPaneView={PaneView.TopTable}
        setLeftPaneView={setLeftPaneView}
        rightPaneView={PaneView.FlameGraph}
        setRightPaneView={setRightPaneView}
        singleView={PaneView.FlameGraph}
        setSingleView={setSingleView}
        containerWidth={1600}
        onReset={onReset}
        showResetButton={true}
        stickyHeader={false}
        {...props}
      />
    );

    return {
      renderResult,
      handlers: {
        setSearch,
        setSelectedView,
        onReset,
      },
    };
  }

  it('show reset button when needed', async () => {
    setup({ showResetButton: false });
    expect(screen.queryByLabelText(/Reset focus/)).toBeNull();

    setup();
    expect(screen.getByLabelText(/Reset focus/)).toBeInTheDocument();
  });

  it('calls on reset when reset button is clicked', async () => {
    const { handlers } = setup();
    const resetButton = screen.getByLabelText(/Reset focus/);
    expect(resetButton).toBeInTheDocument();
    await userEvent.click(resetButton);
    expect(handlers.onReset).toHaveBeenCalledTimes(1);
  });
});
