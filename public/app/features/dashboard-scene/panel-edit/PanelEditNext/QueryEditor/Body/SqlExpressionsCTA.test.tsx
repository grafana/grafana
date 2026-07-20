import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SqlExpressionsCTA } from './SqlExpressionsCTA';

describe('SqlExpressionsCTA', () => {
  it('renders the description text and action button', () => {
    render(<SqlExpressionsCTA onAddSqlExpression={jest.fn()} />);

    expect(screen.getByText(/Prefer SQL/i)).toBeInTheDocument();
    expect(screen.getByTestId('sql-expressions-cta-button')).toBeInTheDocument();
  });

  it('calls onAddSqlExpression when the button is clicked', async () => {
    const onAddSqlExpression = jest.fn();
    render(<SqlExpressionsCTA onAddSqlExpression={onAddSqlExpression} />);

    await userEvent.click(screen.getByTestId('sql-expressions-cta-button'));

    expect(onAddSqlExpression).toHaveBeenCalledTimes(1);
  });
});
