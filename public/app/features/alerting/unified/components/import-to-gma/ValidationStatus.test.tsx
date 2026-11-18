import { render, screen, within } from 'test/test-utils';

import { ValidationStatus } from './ValidationStatus';
import { type DryRunValidationResult } from './types';

const errorResult = (error?: string): DryRunValidationResult => ({
  valid: false,
  error,
  renamedReceivers: [],
  renamedTimeIntervals: [],
});

describe('ValidationStatus error state', () => {
  it('renders each decoder error as a list item under the summary line', () => {
    render(
      <ValidationStatus
        state="error"
        result={errorResult(
          [
            'yaml: unmarshal errors:',
            '  line 1: field bogus_route_field not found in type config.plain',
            '  line 4: field not_a_webhook_field not found in type webhook.plain',
            '  line 7: field unknown_integration_configs not found in type config.plain',
          ].join('\n')
        )}
      />
    );

    expect(screen.getByText('yaml: unmarshal errors:')).toBeInTheDocument();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'line 1: field bogus_route_field not found in type config.plain',
      'line 4: field not_a_webhook_field not found in type webhook.plain',
      'line 7: field unknown_integration_configs not found in type config.plain',
    ]);
  });

  it('renders a single-line error as plain text', () => {
    render(<ValidationStatus state="error" result={errorResult('something went wrong')} />);

    expect(screen.getByText('something went wrong')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('does not create list items for empty lines', () => {
    render(<ValidationStatus state="error" result={errorResult('summary:\n\n  first\n   \n  second\n')} />);

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['first', 'second']);
  });

  it('falls back to the generic message when the error is empty', () => {
    render(<ValidationStatus state="error" result={errorResult(' \n ')} />);

    expect(screen.getByText('Failed to validate the configuration.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
