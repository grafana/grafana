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
});
