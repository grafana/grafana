import { render, screen } from '@testing-library/react';

import { ColorCard } from './ColorCard';

describe('ColorCard', () => {
  it('renders the title prop and plain children as content', () => {
    render(<ColorCard title="Something broke">It happened at 10:45</ColorCard>);

    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.getByText('It happened at 10:45')).toBeInTheDocument();
  });

  it('renders sub components', () => {
    render(
      <ColorCard variant="warning" size="sm">
        <ColorCard.Icon name="exclamation-triangle" />
        <ColorCard.Title>My title</ColorCard.Title>
        <ColorCard.Content>Some long content</ColorCard.Content>
        <ColorCard.Actions>
          <button type="button">Close</button>
        </ColorCard.Actions>
      </ColorCard>
    );

    expect(screen.getByText('My title')).toBeInTheDocument();
    expect(screen.getByText('Some long content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('uses an assertive role for error and warning, and a polite one otherwise', () => {
    const { rerender } = render(<ColorCard variant="error" title="Boom" />);
    expect(screen.getByRole('alert')).toHaveAccessibleName('Boom');

    rerender(<ColorCard variant="info" title="FYI" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('FYI');
  });
});
