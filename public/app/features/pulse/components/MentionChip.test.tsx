import { render, screen } from '@testing-library/react';

import { MentionChip } from './MentionChip';

describe('MentionChip', () => {
  it('renders an assistant mention as an @-prefixed static label', () => {
    render(<MentionChip mention={{ kind: 'assistant', targetId: 'assistant', displayName: 'Grafana Assistant' }} />);
    const chip = screen.getByText('@Grafana Assistant');
    expect(chip).toBeInTheDocument();
    // Static label, not a navigable link.
    expect(chip.closest('a')).toBeNull();
    expect(chip.closest('button')).toBeNull();
  });

  it('renders a user mention with the @ prefix', () => {
    render(<MentionChip mention={{ kind: 'user', targetId: '7', displayName: 'alice' }} />);
    expect(screen.getByText('@alice')).toBeInTheDocument();
  });

  it('renders a dashboard mention as a navigable link', () => {
    render(<MentionChip mention={{ kind: 'dashboard', targetId: 'abc', displayName: 'My dash' }} />);
    const link = screen.getByText('#My dash').closest('a');
    expect(link).toHaveAttribute('href', '/d/abc');
  });
});
