import { act, fireEvent, render, screen } from '@testing-library/react';

import { store } from '@grafana/data';

import { GrotRunner } from './GrotRunner';

const BEST_SCORE_KEY = 'grafana.grotLoadingGame.best';

describe('GrotRunner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    store.delete(BEST_SCORE_KEY);
    // Always spawn a single alert bell so the run is deterministic.
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function advance(ms: number) {
    // Step in frame-sized chunks so the game loop sees realistic deltas.
    for (let t = 0; t < ms; t += 16) {
      act(() => {
        jest.advanceTimersByTime(16);
      });
    }
  }

  it('shows the stored best score', () => {
    store.set(BEST_SCORE_KEY, 1234);
    render(<GrotRunner loadingDone={false} readyLabel="Explore is ready" onContinue={jest.fn()} />);

    expect(screen.getByText('Best 1234 ms')).toBeInTheDocument();
  });

  it('starts on space, crashes into the first alert and stores the score as best', () => {
    render(<GrotRunner loadingDone={false} readyLabel="Explore is ready" onContinue={jest.fn()} />);
    const canvas = screen.getByLabelText('Grot runner game. Press space to jump.');

    fireEvent.keyDown(canvas, { key: ' ' });
    expect(screen.getByText('Jump over alerts and broken pods')).toBeInTheDocument();

    // The first bell spawns after 0.8s and reaches Grot well within 4s if Grot never jumps again.
    advance(4000);

    const crashed = screen.getByText(/^Ouch, \d+ ms\. Space to try again$/);
    const score = Number(crashed.textContent?.match(/\d+/)?.[0]);
    expect(score).toBeGreaterThan(1500);
    expect(score).toBeLessThan(4000);
    expect(Number(store.get(BEST_SCORE_KEY))).toBe(score);
  });

  it('ignores input and offers to continue once loading is done', () => {
    const onContinue = jest.fn();
    render(<GrotRunner loadingDone={true} readyLabel="Explore is ready" onContinue={onContinue} />);

    fireEvent.keyDown(screen.getByLabelText('Grot runner game. Press space to jump.'), { key: ' ' });
    expect(screen.queryByText('Jump over alerts and broken pods')).not.toBeInTheDocument();
    expect(screen.getByText('Explore is ready')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
