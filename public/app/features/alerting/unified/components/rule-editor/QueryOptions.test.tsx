import { render, screen, userEvent } from 'test/test-utils';

import { TestProvider } from 'test/helpers/TestProvider';

import { QueryOptions } from './QueryOptions';

import type { AlertQuery } from 'app/types/unified-alerting-dto';

const mockQuery = {
  refId: 'A',
  relativeTimeRange: { from: 600, to: 0 },
} as AlertQuery;

const defaultOptions = {
  maxDataPoints: 1000,
  minInterval: '15s',
};

describe('QueryOptions', () => {
  it('renders the options button with correct aria attributes', () => {
    render(
      <TestProvider>
        <QueryOptions
          query={mockQuery}
          queryOptions={defaultOptions}
          onChangeQueryOptions={jest.fn()}
          index={0}
        />
      </TestProvider>
    );

    const button = screen.getByRole('button', { name: /toggle query options/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles aria-expanded when options button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestProvider>
        <QueryOptions
          query={mockQuery}
          queryOptions={defaultOptions}
          onChangeQueryOptions={jest.fn()}
          index={0}
        />
      </TestProvider>
    );

    const button = screen.getByRole('button', { name: /toggle query options/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('blurs the active element when toggletip closes', async () => {
    const user = userEvent.setup();

    render(
      <TestProvider>
        <QueryOptions
          query={mockQuery}
          queryOptions={defaultOptions}
          onChangeQueryOptions={jest.fn()}
          index={0}
        />
      </TestProvider>
    );

    const button = screen.getByRole('button', { name: /toggle query options/i });
    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toBe(button);

    await user.keyboard('{Escape}');

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).not.toBe(button);
  });

  it('displays time range, max data points and min interval values', () => {
    render(
      <TestProvider>
        <QueryOptions
          query={mockQuery}
          queryOptions={defaultOptions}
          onChangeQueryOptions={jest.fn()}
          index={0}
        />
      </TestProvider>
    );

    expect(screen.getByText(/MD = 1000/)).toBeInTheDocument();
    expect(screen.getByText(/Min. Interval = 15s/)).toBeInTheDocument();
  });

  it('does not render time range picker when onChangeTimeRange is not provided', async () => {
    const user = userEvent.setup();

    render(
      <TestProvider>
        <QueryOptions
          query={mockQuery}
          queryOptions={defaultOptions}
          onChangeQueryOptions={jest.fn()}
          index={0}
        />
      </TestProvider>
    );

    const button = screen.getByRole('button', { name: /toggle query options/i });
    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByLabelText(/time range/i)).not.toBeInTheDocument();
  });
});
