import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GrotLoadingPill } from './GrotLoadingPill';

describe('GrotLoadingPill', () => {
  it('opens and closes the game from the Grot badge', async () => {
    const user = userEvent.setup();
    render(<GrotLoadingPill label="Preparing Explore" done={false} readyLabel="Explore is ready" />);

    expect(screen.getByRole('status')).toHaveTextContent('Preparing Explore');
    expect(screen.queryByText('Press space or tap to start')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Play a game with Grot while you wait' }));
    expect(screen.getByText('Press space or tap to start')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close the Grot game' }));
    expect(screen.queryByText('Press space or tap to start')).not.toBeInTheDocument();
  });

  it('renders nothing once loading is done and the game is not open', () => {
    const { container } = render(
      <GrotLoadingPill label="Explore is ready" done={true} readyLabel="Explore is ready" />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the game open when loading finishes mid-game and goes away on Continue', async () => {
    const user = userEvent.setup();
    const { rerender, container } = render(
      <GrotLoadingPill label="Preparing Explore" done={false} readyLabel="Explore is ready" />
    );
    await user.click(screen.getByRole('button', { name: 'Play a game with Grot while you wait' }));

    rerender(<GrotLoadingPill label="Explore is ready" done={true} readyLabel="Explore is ready" />);
    expect(screen.getByText('You kept Grot alive for 0 ms')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(container).toBeEmptyDOMElement();
  });
});
