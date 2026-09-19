import { act, render, screen } from 'test/test-utils';

import { SolutionStatsRow } from './SolutionStatsRow';
import { deferred } from './test-utils';

const nullFact = async () => null;

describe('SolutionStatsRow', () => {
  it('shows skeletons instead of the previous numbers while new fact fns re-resolve, then the new numbers', async () => {
    const { rerender } = render(
      <SolutionStatsRow
        stats={async () => ({ primary: '240 pods' })}
        refinedStats={nullFact}
        sparkline={nullFact}
        statsTestId="stats-skeleton"
      />
    );
    expect(await screen.findByText('240 pods')).toBeInTheDocument();
    expect(screen.queryByTestId('stats-skeleton')).not.toBeInTheDocument();

    // New identities (as after a Kubernetes filter save) still pending: useAsync retains the old
    // value, but numbers from the old scope must not render.
    const next = deferred<{ primary: string }>();
    rerender(
      <SolutionStatsRow
        stats={() => next.promise}
        refinedStats={nullFact}
        sparkline={nullFact}
        statsTestId="stats-skeleton"
      />
    );
    expect(await screen.findByTestId('stats-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('240 pods')).not.toBeInTheDocument();

    await act(async () => next.resolve({ primary: '42 pods' }));

    expect(await screen.findByText('42 pods')).toBeInTheDocument();
    expect(screen.queryByTestId('stats-skeleton')).not.toBeInTheDocument();
  });

  it('yields to the fresh base stats while a re-resolving refinement is still pending', async () => {
    const { rerender } = render(
      <SolutionStatsRow
        stats={async () => ({ primary: '2 hosts' })}
        refinedStats={async () => ({ primary: '2 hosts · 5 services' })}
        sparkline={nullFact}
      />
    );
    expect(await screen.findByText('2 hosts · 5 services')).toBeInTheDocument();

    rerender(
      <SolutionStatsRow
        stats={async () => ({ primary: '3 hosts' })}
        refinedStats={() => new Promise(() => {})}
        sparkline={nullFact}
      />
    );

    expect(await screen.findByText('3 hosts')).toBeInTheDocument();
    expect(screen.queryByText('2 hosts · 5 services')).not.toBeInTheDocument();
  });
});
