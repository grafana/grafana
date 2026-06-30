import { render, screen } from 'test/test-utils';

import { HomeDataCard } from './HomeDataCard';

const BODY = 'card-body-content';
const FOOTER = 'card-footer-content';
const BADGE = 'card-badge';
const ACTIONS = 'card-actions';

describe('HomeDataCard', () => {
  it('renders the title, body and footer in the happy path', () => {
    render(
      <HomeDataCard title="My Card" footer={<span>{FOOTER}</span>}>
        <span>{BODY}</span>
      </HomeDataCard>
    );

    expect(screen.getByRole('heading', { name: 'My Card' })).toBeInTheDocument();
    expect(screen.getByText(BODY)).toBeInTheDocument();
    expect(screen.getByText(FOOTER)).toBeInTheDocument();
  });

  it('renders the title badge and header actions when not loading', () => {
    render(
      <HomeDataCard title="My Card" titleBadge={<span>{BADGE}</span>} headerActions={<span>{ACTIONS}</span>}>
        <span>{BODY}</span>
      </HomeDataCard>
    );

    expect(screen.getByText(BADGE)).toBeInTheDocument();
    expect(screen.getByText(ACTIONS)).toBeInTheDocument();
  });

  it('hides body, footer, badge and actions while loading', () => {
    render(
      <HomeDataCard
        title="My Card"
        loading
        titleBadge={<span>{BADGE}</span>}
        headerActions={<span>{ACTIONS}</span>}
        footer={<span>{FOOTER}</span>}
      >
        <span>{BODY}</span>
      </HomeDataCard>
    );

    // The title still renders; everything gated on the loaded data does not.
    expect(screen.getByRole('heading', { name: 'My Card' })).toBeInTheDocument();
    expect(screen.queryByText(BODY)).not.toBeInTheDocument();
    expect(screen.queryByText(FOOTER)).not.toBeInTheDocument();
    expect(screen.queryByText(BADGE)).not.toBeInTheDocument();
    expect(screen.queryByText(ACTIONS)).not.toBeInTheDocument();
  });

  it('shows a retryable error and calls onRetry on click', async () => {
    const onRetry = jest.fn();
    const { user } = render(
      <HomeDataCard title="My Card" error={{ title: 'Boom happened', onRetry }} footer={<span>{FOOTER}</span>}>
        <span>{BODY}</span>
      </HomeDataCard>
    );

    expect(screen.getByText('Boom happened')).toBeInTheDocument();
    // Body and footer are suppressed in the error state.
    expect(screen.queryByText(BODY)).not.toBeInTheDocument();
    expect(screen.queryByText(FOOTER)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty message and hides the body when empty', () => {
    render(
      <HomeDataCard title="My Card" isEmpty emptyMessage="Nothing here">
        <span>{BODY}</span>
      </HomeDataCard>
    );

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByText(BODY)).not.toBeInTheDocument();
  });
});
