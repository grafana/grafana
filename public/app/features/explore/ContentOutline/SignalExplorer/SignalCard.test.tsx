import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-prometheus)' })).toHaveAttribute(
      'aria-label',
      'Jump to query A (gdev-prometheus)'
    );
  });

  it('jumps to the query when the card is clicked', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /^Jump to query A/ }));

    expect(onJumpToQuery).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('jumps to the query when the card is activated with %s', async (_, key) => {
    const { user } = setup();

    screen.getByRole('button', { name: /^Jump to query A/ }).focus();
    await user.keyboard(key);

    expect(onJumpToQuery).toHaveBeenCalledTimes(1);
    expect(onToggleExpanded).not.toHaveBeenCalled();
  });

  it('toggles the expanded state without jumping to the query', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A', expanded: false }));

    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(onJumpToQuery).not.toHaveBeenCalled();
  });

  // The chevron sits inside the card's own role="button", so its keydowns bubble to
  // the card. If the card claimed them it would preventDefault the chevron's
  // activation and scroll to the query instead of expanding.
  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('toggles the expanded state when the chevron is activated with %s', async (_, key) => {
    const { user } = setup();

    screen.getByRole('button', { name: 'Expand datasource explorer for query A' }).focus();
    await user.keyboard(key);

    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    expect(onJumpToQuery).not.toHaveBeenCalled();
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
      screen.getByRole('button', { name: 'Collapse datasource explorer for query A', expanded: true })
    ).toBeInTheDocument();
  });

  it('has no expand control and never renders a body when not expandable', () => {
    setup({ isExpandable: false, isExpanded: true, datasourceName: 'gdev-loki' });

    // Counting buttons rather than querying the chevron by name keeps this from
    // passing vacuously if the chevron's label is ever reworded: the card header is
    // the only button a non-expandable card should have.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-loki)' })).toBeInTheDocument();
    expect(screen.queryByText('card body')).not.toBeInTheDocument();
  });
});
