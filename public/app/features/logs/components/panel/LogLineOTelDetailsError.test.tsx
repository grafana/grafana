import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type FieldDef } from '../logParser';

import { LogLineOTelDetailsError } from './LogLineOTelDetailsError';

function field(key: string, value: string, fieldIndex: number): FieldDef {
  return { keys: [key], values: [value], fieldIndex };
}

describe('LogLineOTelDetailsError', () => {
  it('keeps the stack trace collapsed until it is expanded', async () => {
    const user = userEvent.setup();

    render(
      <LogLineOTelDetailsError
        fields={[
          field('exception.message', 'Cannot invoke User.getId()', 0),
          field('exception.stacktrace', 'at UserService.getUserId', 1),
        ]}
        labels={[]}
      />
    );

    expect(screen.getByText('Cannot invoke User.getId()')).toBeInTheDocument();
    expect(screen.queryByText('at UserService.getUserId')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'exception.stacktrace' })).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: 'exception.stacktrace' }));

    expect(screen.getByText('at UserService.getUserId')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'exception.stacktrace' })).toHaveAttribute('aria-expanded', 'true');
  });
});
