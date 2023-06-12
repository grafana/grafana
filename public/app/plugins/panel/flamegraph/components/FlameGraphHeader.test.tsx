import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CoreApp } from '@grafana/data';

import FlameGraphHeader from './FlameGraphHeader';
import { SelectedView } from './types';

describe('FlameGraphHeader', () => {
  function setup(props: Partial<React.ComponentProps<typeof FlameGraphHeader>> = {}) {
    const setSearch = jest.fn();
    const setSelectedView = jest.fn();
    const onReset = jest.fn();

    const renderResult = render(
      <FlameGraphHeader
        app={CoreApp.Explore}
        search={''}
        setSearch={setSearch}
        selectedView={SelectedView.Both}
        setSelectedView={setSelectedView}
        containerWidth={1600}
        onReset={onReset}
        onTextAlignChange={jest.fn()}
        textAlign={'left'}
        showResetButton={true}
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
