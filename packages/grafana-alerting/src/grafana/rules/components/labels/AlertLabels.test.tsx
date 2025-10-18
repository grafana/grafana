import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AlertLabels } from './AlertLabels';

describe('AlertLabels', () => {
  it('should toggle show / hide common labels', async () => {
    const labels = { foo: 'bar', bar: 'baz', baz: 'qux' };
    const another = { foo: 'bar', baz: 'qux', extra: 'z' };

    render(<AlertLabels labels={labels} displayCommonLabels labelSets={[labels, another]} />);
    expect(screen.getByText('+2 common labels')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('Hide common labels')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('+2 common labels')).toBeInTheDocument();
    });
  });
});
