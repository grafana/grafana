import { render, screen } from 'test/test-utils';

import { resourceKindInfos } from '../utils/resourceKinds';

import { OverviewStatCards } from './OverviewStatCards';
import { type KindTotals } from './stats';

const dashboards = (instanceTotal: number, managed: number): KindTotals => ({
  kind: resourceKindInfos.dashboard,
  totals: { instanceTotal, managed },
});

const playlists = (instanceTotal: number, managed: number): KindTotals => ({
  kind: resourceKindInfos.playlist,
  totals: { instanceTotal, managed },
});

describe('OverviewStatCards', () => {
  it('shows a managed-ratio card per kind that has resources', () => {
    render(<OverviewStatCards totals={[dashboards(100, 50)]} />);

    // Dashboards card: 50 of 100 managed => 50%.
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('50 of 100 managed')).toBeInTheDocument();
  });

  it('does not render a combined all-resources card when only one kind has data', () => {
    render(<OverviewStatCards totals={[dashboards(100, 50)]} />);

    expect(screen.queryByText('Playlists')).not.toBeInTheDocument();
    expect(screen.queryByText('All resources')).not.toBeInTheDocument();
  });

  it('shows per-kind cards plus a combined all-resources card when more than one kind has data', () => {
    render(<OverviewStatCards totals={[dashboards(100, 50), playlists(20, 5)]} />);

    // Dashboards: 50 of 100 managed.
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.getByText('50 of 100 managed')).toBeInTheDocument();

    // Playlists: 5 of 20 managed => 25%.
    expect(screen.getByText('Playlists')).toBeInTheDocument();
    expect(screen.getByText('5 of 20 managed')).toBeInTheDocument();

    // Combined: 55 of 120 managed.
    expect(screen.getByText('All resources')).toBeInTheDocument();
    expect(screen.getByText('55 of 120 managed')).toBeInTheDocument();
  });

  it('hides a card whose total is zero, and the combined card when only one kind has data', () => {
    // No dashboards exist, but playlists do — only the playlists card renders.
    // The combined "All resources" card would just mirror it, so it stays hidden.
    render(<OverviewStatCards totals={[dashboards(0, 0), playlists(20, 5)]} />);

    expect(screen.queryByText('Dashboards')).not.toBeInTheDocument();
    expect(screen.getByText('Playlists')).toBeInTheDocument();
    expect(screen.queryByText('All resources')).not.toBeInTheDocument();
  });
});
