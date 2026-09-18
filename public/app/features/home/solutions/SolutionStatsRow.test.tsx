import { render, screen } from 'test/test-utils';

import { SolutionStatsRow } from './SolutionStatsRow';

const nullFact = async () => null;

describe('SolutionStatsRow', () => {
  it('replaces the previous numbers with skeletons while new fact fns re-resolve', async () => {
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
    rerender(
      <SolutionStatsRow
        stats={() => new Promise(() => {})}
        refinedStats={nullFact}
        sparkline={nullFact}
        statsTestId="stats-skeleton"
      />
    );

    expect(await screen.findByTestId('stats-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('240 pods')).not.toBeInTheDocument();
  });

  it('renders the refetched numbers once the new fact fns settle', async () => {
    const { rerender } = render(
      <SolutionStatsRow stats={async () => ({ primary: '240 pods' })} refinedStats={nullFact} sparkline={nullFact} />
    );
    expect(await screen.findByText('240 pods')).toBeInTheDocument();

    rerender(
      <SolutionStatsRow stats={async () => ({ primary: '42 pods' })} refinedStats={nullFact} sparkline={nullFact} />
    );

    expect(await screen.findByText('42 pods')).toBeInTheDocument();
    expect(screen.queryByText('240 pods')).not.toBeInTheDocument();
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
