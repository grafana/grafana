import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from '@grafana/ui';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { ExpressionTypeDropdown } from './ExpressionTypeDropdown';

describe('ExpressionTypeDropdown', () => {
  it('exposes one menu item per expression and supports keyboard selection', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    render(
      <ExpressionTypeDropdown handleOnSelect={onSelect}>
        <Button>Add expression</Button>
      </ExpressionTypeDropdown>
    );

    await user.click(screen.getByRole('button', { name: 'Add expression' }));
    const menu = await screen.findByRole('menu');
    const math = within(menu).getByRole('menuitem', { name: 'Math' });
    expect(math).toHaveProperty('tagName', 'BUTTON');

    math.focus();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(ExpressionQueryType.math);
  });

  it('exposes the option description to assistive technology', async () => {
    const user = userEvent.setup();
    render(
      <ExpressionTypeDropdown handleOnSelect={jest.fn()}>
        <Button>Add expression</Button>
      </ExpressionTypeDropdown>
    );

    await user.click(screen.getByRole('button', { name: 'Add expression' }));
    const menu = await screen.findByRole('menu');

    expect(
      within(menu).getByRole('menuitem', {
        name: 'Math',
        description: 'Free-form math formulas on time series or number data.',
      })
    ).toBeInTheDocument();
  });

  it('keeps disabled expressions disabled while other expressions remain selectable', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    render(
      <ExpressionTypeDropdown
        handleOnSelect={onSelect}
        disabledExpressions={{ [ExpressionQueryType.math]: 'Math is unavailable' }}
      >
        <Button>Add expression</Button>
      </ExpressionTypeDropdown>
    );

    await user.click(screen.getByRole('button', { name: 'Add expression' }));
    const menu = await screen.findByRole('menu');
    const math = within(menu).getByRole('menuitem', { name: 'Math', description: 'Math is unavailable' });
    expect(math).toBeDisabled();
    await user.click(math);
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(within(menu).getByRole('menuitem', { name: 'Reduce' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(ExpressionQueryType.reduce);
  });
});
