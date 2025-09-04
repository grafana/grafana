import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { CollapsedMap } from './FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import { ColorScheme, SelectedView } from './types';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(() => [false, null]), // [isAvailable, openAssistant]
  createAssistantContextItem: jest.fn(),
  OpenAssistantButton: () => <div>OpenAssistantButton</div>,
}));

describe('FlameGraphHeader', () => {
  function setup(props: Partial<React.ComponentProps<typeof FlameGraphHeader>> = {}) {
    const setSearch = jest.fn();
    const setSelectedView = jest.fn();
    const onReset = jest.fn();
    const onSchemeChange = jest.fn();

    const renderResult = render(
      <FlameGraphHeader
        search={''}
        setSearch={setSearch}
        selectedView={SelectedView.Both}
        setSelectedView={setSelectedView}
        containerWidth={1600}
        onReset={onReset}
        onTextAlignChange={jest.fn()}
        textAlign={'left'}
        showResetButton={true}
        colorScheme={ColorScheme.ValueBased}
        onColorSchemeChange={onSchemeChange}
        stickyHeader={false}
        isDiffMode={false}
        setCollapsedMap={() => {}}
        collapsedMap={new CollapsedMap()}
        {...props}
      />
    );

    return {
      renderResult,
      handlers: {
        setSearch,
        setSelectedView,
        onReset,
        onSchemeChange,
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

  it('calls on color scheme change when clicked', async () => {
    const { handlers } = setup();
    const changeButton = screen.getByLabelText(/Change color scheme/);
    expect(changeButton).toBeInTheDocument();
    await userEvent.click(changeButton);

    const byPackageButton = screen.getByText(/By package name/);
    expect(byPackageButton).toBeInTheDocument();
    await userEvent.click(byPackageButton);

    expect(handlers.onSchemeChange).toHaveBeenCalledTimes(1);
  });

  it('shows diff color scheme switch when diff', async () => {
    setup({ isDiffMode: true });
    const changeButton = screen.getByLabelText(/Change color scheme/);
    expect(changeButton).toBeInTheDocument();
    await userEvent.click(changeButton);

    expect(screen.getByText(/Default/)).toBeInTheDocument();
    expect(screen.getByText(/Color blind/)).toBeInTheDocument();
  });
});
