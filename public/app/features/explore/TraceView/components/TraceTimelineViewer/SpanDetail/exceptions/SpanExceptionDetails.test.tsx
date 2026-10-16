import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SpanExceptionDetails from './SpanExceptionDetails';
import { type SpanException } from './span-exception';

const exception: SpanException = {
  type: 'java.lang.NullPointerException',
  message: 'Cannot invoke User.getId()',
  stacktrace: 'at UserService.getUserId',
};

describe('<SpanExceptionDetails>', () => {
  it('shows the exception type and message with stacktrace collapsed', () => {
    render(<SpanExceptionDetails exception={exception} />);

    expect(screen.getByRole('alert')).toHaveAccessibleName('Exception');
    expect(screen.queryByText('Exception')).not.toBeInTheDocument();
    expect(screen.getByText('Type:')).toBeInTheDocument();
    expect(screen.getByText('java.lang.NullPointerException')).toBeInTheDocument();
    expect(screen.getByText('Message:')).toBeInTheDocument();
    expect(screen.getByText('Cannot invoke User.getId()')).toBeInTheDocument();
    expect(screen.queryByText('at UserService.getUserId')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stacktrace' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the stacktrace body when the stacktrace section is expanded', async () => {
    render(<SpanExceptionDetails exception={exception} />);

    await userEvent.click(screen.getByRole('button', { name: 'Stacktrace' }));

    expect(screen.getByText('at UserService.getUserId')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stacktrace' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('omits the type row when type is missing', () => {
    render(<SpanExceptionDetails exception={{ stacktrace: 'at main' }} />);

    expect(screen.getByRole('alert')).toHaveAccessibleName('Exception');
    expect(screen.queryByText('Type:')).not.toBeInTheDocument();
    expect(screen.queryByText('Message:')).not.toBeInTheDocument();
    expect(screen.queryByText('at main')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stacktrace' })).toBeInTheDocument();
  });

  it('renders nothing when type, message, and stacktrace are all missing', () => {
    render(<SpanExceptionDetails exception={{}} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
