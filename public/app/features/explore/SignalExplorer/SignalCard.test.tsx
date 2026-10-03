import { fireEvent, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';

import { SignalCard } from './SignalCard';

const onJumpToQuery = jest.fn();
const onToggleExpanded = jest.fn();

const setup = (overrides: Partial<Parameters<typeof SignalCard>[0]> = {}) => {
  return {
    user: userEvent.setup(),
    ...render(
      <SignalCard
        refId="A"
        datasourceName="gdev-prometheus"
        isExpandable={true}
        isExpanded={false}
        onToggleExpanded={onToggleExpanded}
        onJumpToQuery={onJumpToQuery}
        {...overrides}
      >
        <div>card body</div>
      </SignalCard>
    ),
  };
};

describe('<SignalCard />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the refId inline and keeps the datasource name in the accessible name', () => {
    setup();

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('gdev-prometheus')).not.toBeInTheDocument();
    // The card is named by its refId text, so a `title` alone would lose to it in a
    // browser. Assert the label itself rather than trusting Testing Library, whose
    // accessible name implementation still falls back to the tooltip.
    expect(
      screen.getByRole('button', { name: 'Expand datasource explorer for query A (gdev-prometheus)' })
    ).toHaveAttribute('aria-label', 'Expand datasource explorer for query A (gdev-prometheus)');
  });

  // The chevron is decoration inside the one header button, so a click anywhere on the row
  // lands on the same control.
  it('makes the whole header a single control on an expandable card', () => {
    setup();

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { expanded: false })).toContainElement(screen.getByTestId('icon-angle-right'));
  });

  it.each([
    ['a click', (user: UserEvent) => user.click(screen.getByRole('button', { expanded: false }))],
    [
      'Enter',
      (user: UserEvent) => {
        screen.getByRole('button', { expanded: false }).focus();
        return user.keyboard('{Enter}');
      },
    ],
    [
      'Space',
      (user: UserEvent) => {
        screen.getByRole('button', { expanded: false }).focus();
        return user.keyboard(' ');
      },
    ],
  ])('expands the card and jumps to its query on %s', async (_, activate) => {
    const { user } = setup();

    await activate(user);

    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(onJumpToQuery).toHaveBeenCalledTimes(1);
  });

  it('collapses an expanded card without jumping to its query', async () => {
    const { user } = setup({ isExpanded: true });

    await user.click(
      screen.getByRole('button', { name: 'Collapse datasource explorer for query A (gdev-prometheus)', expanded: true })
    );

    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(onJumpToQuery).not.toHaveBeenCalled();
  });

  it('only jumps to the query when a non-expandable card is clicked', async () => {
    const { user } = setup({ isExpandable: false, datasourceName: 'gdev-loki' });

    await user.click(screen.getByRole('button', { name: 'Jump to query A (gdev-loki)' }));

    expect(onJumpToQuery).toHaveBeenCalledTimes(1);
    expect(onToggleExpanded).not.toHaveBeenCalled();
  });

  // A `fireEvent` because no user action can make an image fail to load.
  it('falls back to the datasource icon when the logo fails to load', () => {
    const { container } = setup({ datasourceLogo: 'public/plugins/gone/img/logo.svg' });
    const logo = container.querySelector('img');

    expect(logo).toBeInTheDocument();
    expect(screen.queryByTestId('icon-database')).not.toBeInTheDocument();

    fireEvent.error(logo!);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('icon-database')).toBeInTheDocument();
  });

  it('renders the body only when expanded', () => {
    const { rerender } = setup();
    expect(screen.queryByText('card body')).not.toBeInTheDocument();

    rerender(
      <SignalCard
        refId="A"
        datasourceName="gdev-prometheus"
        isExpandable={true}
        isExpanded={true}
        onToggleExpanded={onToggleExpanded}
        onJumpToQuery={onJumpToQuery}
      >
        <div>card body</div>
      </SignalCard>
    );

    expect(screen.getByText('card body')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Collapse datasource explorer for query A (gdev-prometheus)', expanded: true })
    ).toBeInTheDocument();
  });

  it('has no chevron or expanded state and never renders a body when not expandable', () => {
    setup({ isExpandable: false, isExpanded: true, datasourceName: 'gdev-loki' });

    const header = screen.getByRole('button', { name: 'Jump to query A (gdev-loki)' });
    expect(header).not.toHaveAttribute('aria-expanded');
    expect(screen.queryByTestId('icon-angle-right')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-angle-down')).not.toBeInTheDocument();
    expect(screen.queryByText('card body')).not.toBeInTheDocument();
  });
});
