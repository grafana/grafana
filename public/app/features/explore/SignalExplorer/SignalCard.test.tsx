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
        isOnlyCard={false}
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
    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-prometheus)' })).toHaveAttribute(
      'aria-label',
      'Jump to query A (gdev-prometheus)'
    );
  });

  // The chevron is decoration inside the toggle, so a click anywhere on the row but the jump
  // button lands on the same control.
  it('splits an expandable header into a toggle holding the chevron and a jump button', () => {
    setup();

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { expanded: false })).toContainElement(screen.getByTestId('icon-angle-right'));
    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-prometheus)' })).not.toHaveAttribute(
      'aria-expanded'
    );
  });

  it('gives a non-expandable card the jump button as its only control', () => {
    setup({ isExpandable: false, datasourceName: 'gdev-loki' });

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button')).toHaveAccessibleName('Jump to query A (gdev-loki)');
  });

  // With no toggle to carry its label, the static header still tells two cards on the same
  // datasource type apart on hover.
  it('shows the datasource name as the tooltip of a non-expandable header', () => {
    setup({ isExpandable: false, datasourceName: 'gdev-loki' });

    expect(screen.getByTitle('gdev-loki')).toContainElement(screen.getByText('A'));
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
  ])('expands the card without jumping to its query on %s', async (_, activate) => {
    const { user } = setup();

    await activate(user);

    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(onJumpToQuery).not.toHaveBeenCalled();
  });

  it('collapses an expanded card without jumping to its query', async () => {
    const { user } = setup({ isExpanded: true });

    await user.click(
      screen.getByRole('button', { name: 'Collapse datasource explorer for query A (gdev-prometheus)', expanded: true })
    );

    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(onJumpToQuery).not.toHaveBeenCalled();
  });

  it.each([
    { desc: 'a collapsed card', overrides: {}, datasourceName: 'gdev-prometheus' },
    { desc: 'an expanded card', overrides: { isExpanded: true }, datasourceName: 'gdev-prometheus' },
    { desc: 'a non-expandable card', overrides: { isExpandable: false }, datasourceName: 'gdev-loki' },
  ])('jumps to the query without toggling from the jump button on $desc', async ({ overrides, datasourceName }) => {
    const { user } = setup({ ...overrides, datasourceName });

    await user.click(screen.getByRole('button', { name: `Jump to query A (${datasourceName})` }));

    expect(onJumpToQuery).toHaveBeenCalledTimes(1);
    expect(onToggleExpanded).not.toHaveBeenCalled();
  });

  it('does nothing when a non-expandable header is clicked', async () => {
    const { user } = setup({ isExpandable: false, datasourceName: 'gdev-loki' });

    await user.click(screen.getByText('A'));

    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-loki)' })).toBeInTheDocument();
    expect(onJumpToQuery).not.toHaveBeenCalled();
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
        isOnlyCard={false}
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

  const expandedCard = (
    <SignalCard
      refId="A"
      datasourceName="gdev-prometheus"
      isExpandable={true}
      isExpanded={true}
      isOnlyCard={false}
      onToggleExpanded={onToggleExpanded}
      onJumpToQuery={onJumpToQuery}
    >
      <div>card body</div>
    </SignalCard>
  );

  // An expanded card is nearly as tall as the card area, so it would otherwise open past its edge.
  it('scrolls into view when the user expands it', async () => {
    const { user, rerender } = setup();

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A (gdev-prometheus)' }));
    rerender(expandedCard);

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  // The explorer opens its first card by default, which must not scroll the sidebar on open.
  it('does not scroll when it expands without the user asking', () => {
    const { rerender } = setup();

    rerender(expandedCard);

    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('has no chevron or expanded state and never renders a body when not expandable', () => {
    const { container } = setup({ isExpandable: false, isExpanded: true, datasourceName: 'gdev-loki' });

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(container.querySelector('[aria-expanded]')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-angle-right')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-angle-down')).not.toBeInTheDocument();
    expect(screen.queryByText('card body')).not.toBeInTheDocument();
  });
});
