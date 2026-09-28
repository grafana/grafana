import { render, screen } from 'test/test-utils';

import { CascadeDeleteErrorList } from './CascadeDeleteErrorList';

describe('CascadeDeleteErrorList', () => {
  it('shows all errors as a bulleted list when there are 5 or fewer', () => {
    const errors = ['error 1', 'error 2', 'error 3'];
    render(<CascadeDeleteErrorList errors={errors} />);

    for (const error of errors) {
      expect(screen.getByText(error)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('collapses to the first 5 errors, with a "show more" toggle, once there are more than 5', async () => {
    const errors = Array.from({ length: 8 }, (_, i) => `error ${i + 1}`);
    const { user } = render(<CascadeDeleteErrorList errors={errors} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('error 5')).toBeInTheDocument();
    expect(screen.queryByText('error 6')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show 3 more errors/i }));

    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByText('error 8')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show less/i }));

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByText('error 6')).not.toBeInTheDocument();
  });
});
