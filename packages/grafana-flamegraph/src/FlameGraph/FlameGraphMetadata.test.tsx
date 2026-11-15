import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import FlameGraphMetadata from './FlameGraphMetadata';
import { textToDataContainer } from './testHelpers';

function setup(props: Partial<React.ComponentProps<typeof FlameGraphMetadata>> = {}) {
  const container = textToDataContainer(`
      [1//////////////]
      [2][4//][7///]
      [3][5]
         [6]
    `)!;

  const onFocusPillClick = jest.fn();
  const onSandwichPillClick = jest.fn();
  const renderResult = render(
    <FlameGraphMetadata
      data={container}
      totalTicks={17}
      totalProfileTicks={17}
      onFocusPillClick={onFocusPillClick}
      onSandwichPillClick={onSandwichPillClick}
      {...props}
    />
  );

  return { renderResult, mocks: { onSandwichPillClick, onFocusPillClick } };
}

describe('FlameGraphMetadata', () => {
  it('shows only default pill if not focus or sandwich', () => {
    setup();
    expect(screen.getByText(/17 | 17 samples (Count)/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Remove focus/)).toBeNull();
    expect(screen.queryByLabelText(/Remove sandwich/)).toBeNull();
  });

  it('shows focus pill', async () => {
    const { mocks } = setup({
      focusedItem: {
        label: '4',
        item: {
          value: 5,
          children: [],
          itemIndexes: [3],
          start: 3,
          level: 0,
        },
        posX: 0,
        posY: 0,
      },
    });
    expect(screen.getByText(/17 | 17 samples (Count)/)).toBeInTheDocument();
    expect(screen.getByText(/29.41% of total/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Remove sandwich/)).toBeNull();

    await userEvent.click(screen.getByLabelText(/Remove focus/));
    expect(mocks.onFocusPillClick).toHaveBeenCalledTimes(1);
  });

  it('shows the sandwiched function as a percentage of the whole profile', async () => {
    const { mocks } = setup({
      sandwichedLabel: 'some/random/func.go',
      // View ticks are the selected function; profile ticks are the original total.
      totalTicks: 5,
      totalProfileTicks: 17,
    });
    expect(screen.getByText(/5 | 5 samples (Count)/)).toBeInTheDocument();
    expect(screen.getByText(/29.41% of total/)).toBeInTheDocument();
    expect(screen.queryByText(/func.go/)).toBeNull();
    expect(screen.queryByLabelText(/Remove focus/)).toBeNull();

    await userEvent.hover(screen.getByText(/29.41% of total/));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('some/random/func.go');

    await userEvent.click(screen.getByLabelText(/Remove sandwich/));
    expect(mocks.onSandwichPillClick).toHaveBeenCalledTimes(1);
  });

  it('shows 0% of total in sandwich view when the profile total is 0', () => {
    setup({
      sandwichedLabel: 'func',
      totalTicks: 0,
      totalProfileTicks: 0,
    });
    expect(screen.getByText(/0% of total/)).toBeInTheDocument();
  });
});
