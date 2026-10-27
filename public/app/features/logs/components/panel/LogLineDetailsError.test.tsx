import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';

import { reportInteraction } from '@grafana/runtime';

import { type FieldDef } from '../logParser';

import { LogLineDetailsError } from './LogLineDetailsError';
import { LogListContext, type LogListContextData } from './LogListContext';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

function field(key: string, value: string, fieldIndex: number): FieldDef {
  return { keys: [key], values: [value], fieldIndex };
}

const errorFields = [
  field('exception.message', 'Cannot invoke User.getId()', 0),
  field('exception.stacktrace', 'at UserService.getUserId', 1),
];

function renderError({ noInteractions = false }: { noInteractions?: boolean } = {}) {
  return render(
    <LogListContext.Provider value={{ fontSize: 'default', noInteractions } as LogListContextData}>
      <LogLineDetailsError fields={errorFields} labels={[]} />
    </LogListContext.Provider>
  );
}

describe('LogLineDetailsError', () => {
  beforeEach(() => {
    jest.mocked(reportInteraction).mockClear();
  });

  it('keeps the stack trace collapsed until it is expanded', async () => {
    const user = userEvent.setup();

    render(
      <LogLineDetailsError
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

  it('reports when the stack trace is expanded, collapsed, and copied', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });

    renderError();

    await user.click(screen.getByRole('button', { name: 'exception.stacktrace' }));

    expect(reportInteraction).toHaveBeenCalledTimes(1);
    expect(reportInteraction).toHaveBeenCalledWith('logs_log_line_details_error_stacktrace_toggled', {
      state: 'open',
    });

    const stacktrace = screen.getByRole('button', { name: 'exception.stacktrace' }).parentElement;
    if (!stacktrace) {
      throw new Error('stack trace row was not rendered');
    }
    await user.click(within(stacktrace).getByLabelText('Copy value to clipboard'), {
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });

    await waitFor(() => {
      expect(reportInteraction).toHaveBeenCalledWith('logs_log_line_details_error_stacktrace_copied');
    });

    await user.click(screen.getByRole('button', { name: 'exception.stacktrace' }));

    expect(reportInteraction).toHaveBeenCalledWith('logs_log_line_details_error_stacktrace_toggled', {
      state: 'closed',
    });
    expect(reportInteraction).toHaveBeenCalledTimes(3);
  });

  it('does not report stack trace interactions when interactions are disabled', async () => {
    const user = userEvent.setup();

    renderError({ noInteractions: true });

    await user.click(screen.getByRole('button', { name: 'exception.stacktrace' }));

    expect(screen.getByText('at UserService.getUserId')).toBeInTheDocument();
    expect(reportInteraction).not.toHaveBeenCalled();
  });
});
