import { render, screen, waitFor } from 'test/test-utils';

import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';

import { ctaClicked } from '../analytics/main';
import { type Solution, type SolutionId, type SolutionOffer } from '../solutions/types';

import { AvailableSolutionCard, SolutionCard } from './SolutionCard';

jest.mock('../analytics/main', () => ({ ctaClicked: jest.fn() }));

const mockCtaClicked = jest.mocked(ctaClicked);

function solution(id: SolutionId, overrides: Partial<Solution> = {}): Solution {
  return {
    id,
    title: id,
    icon: 'chart-line',
    signal: async () => 'active',
    datasource: async () => null,
    needsAttention: async () => false,
    stats: async () => null,
    refinedStats: async () => null,
    sparkline: async () => null,
    cta: async () => null,
    alert: async () => null,
    offer: async () => null,
    ...overrides,
  };
}

beforeEach(() => {
  mockCtaClicked.mockClear();
  document.addEventListener('click', interceptLinkClicks);
});

afterEach(() => {
  document.removeEventListener('click', interceptLinkClicks);
});

describe('SolutionCard', () => {
  it('renders and tracks the attention action as the card action', async () => {
    const alert = {
      primary: 'payments-api restarts',
      details: ['14 restarts/hr'],
    };
    const item = solution('kubernetes', {
      title: 'Kubernetes Monitoring',
      icon: 'kubernetes',
      stats: async () => ({ primary: '247 pods' }),
      alert: async () => alert,
      cta: async () => ({
        label: 'Inspect workload in Kubernetes Monitoring',
        href: '/a/grafana-k8s-app/navigation/cluster',
        action: 'view_alerts',
      }),
    });

    const { user } = render(<SolutionCard solution={item} needsAttention />);

    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(await screen.findByText('247 pods')).toBeInTheDocument();
    expect(screen.getByText('payments-api restarts · 14 restarts/hr')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);

    await user.click(await screen.findByRole('link', { name: 'Inspect workload in Kubernetes Monitoring' }));
    expect(mockCtaClicked).toHaveBeenCalledWith({
      surface: 'overview',
      action: 'view_alerts',
      placement: 'card',
      solution: 'kubernetes',
    });
  });

  it('renders an enabled card without inventing a secondary line', async () => {
    const item = solution('metrics', {
      title: 'Metrics & infrastructure',
      stats: async () => ({ primary: '34 services' }),
    });

    render(<SolutionCard solution={item} needsAttention={false} />);

    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(await screen.findByText('34 services')).toBeInTheDocument();
  });

  it('withholds the optional action while it is unresolved', async () => {
    const item = solution('logs', { title: 'Logs', cta: () => new Promise(() => {}) });

    render(<SolutionCard solution={item} needsAttention={false} />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Logs' })).toBeInTheDocument());
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('AvailableSolutionCard', () => {
  it('renders and tracks an enable offer', async () => {
    const item = solution('metrics', { title: 'Metrics & infrastructure' });
    const offer: SolutionOffer = {
      availability: 'enable',
      description: 'Diagnose slow queries and connection saturation.',
      setupHint: '~5 min · collector',
      cta: { label: 'Enable', href: '/plugins/grafana-metricsdrilldown-app/', action: 'enable' },
      learnMore: { href: 'https://grafana.com/docs/grafana-cloud/send-data/metrics/' },
    };

    const { user } = render(<AvailableSolutionCard solution={item} offer={offer} />);

    expect(screen.getByText('Not enabled')).toBeInTheDocument();
    expect(screen.getByText(offer.description)).toBeInTheDocument();
    expect(screen.getByText(offer.setupHint!)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', offer.learnMore?.href);
    await user.click(screen.getByRole('link', { name: 'Enable' }));
    expect(mockCtaClicked).toHaveBeenCalledWith({
      surface: 'overview',
      action: 'enable',
      placement: 'card',
      solution: 'metrics',
    });

    await user.click(screen.getByRole('link', { name: 'Learn more' }));
    expect(mockCtaClicked).toHaveBeenCalledWith({
      surface: 'overview',
      action: 'learn_more',
      placement: 'card',
      solution: 'metrics',
    });
  });

  it('shows an offer without a dead-end action when the user cannot act', () => {
    const item = solution('metrics', { title: 'Metrics & infrastructure' });
    const offer: SolutionOffer = {
      availability: 'enable',
      description: 'Diagnose slow queries and connection saturation.',
      cta: null,
    };

    render(<AvailableSolutionCard solution={item} offer={offer} />);

    expect(screen.getByRole('heading', { name: item.title })).toBeInTheDocument();
    expect(screen.getByText('Not enabled')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('labels an enabled but inactive app as ready to configure', () => {
    const item = solution('kubernetes', { title: 'Kubernetes Monitoring', icon: 'kubernetes' });
    const offer: SolutionOffer = {
      availability: 'setup',
      description: 'See cluster health in one view.',
      cta: { label: 'Set up', href: '/a/grafana-k8s-app/configuration/cluster-config', action: 'setup' },
    };

    render(<AvailableSolutionCard solution={item} offer={offer} />);

    expect(screen.getByText('Ready to configure')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up' })).toHaveAttribute('href', offer.cta!.href);
  });

  it('uses the external-link treatment for learn-more offers', () => {
    const item = solution('traces', { title: 'Traces', icon: 'gf-traces' });
    const offer: SolutionOffer = {
      availability: 'setup',
      description: 'Instrument an application.',
      cta: null,
      learnMore: { href: 'https://grafana.com/docs/grafana-cloud/send-data/traces/' },
    };

    render(<AvailableSolutionCard solution={item} offer={offer} />);

    const link = screen.getByRole('link', { name: 'Learn more' });
    expect(link).toHaveAttribute('href', offer.learnMore?.href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('supports custom internal learn-more links', () => {
    const item = solution('metrics', { title: 'Metrics & infrastructure' });
    const offer: SolutionOffer = {
      availability: 'setup',
      description: 'Connect a metrics source.',
      cta: null,
      learnMore: {
        href: '/connections/add-new-connection',
        label: 'Browse connections',
        external: false,
      },
    };

    render(<AvailableSolutionCard solution={item} offer={offer} />);

    const link = screen.getByRole('link', { name: 'Browse connections' });
    expect(link).toHaveTextContent('Browse connections');
    expect(link).not.toHaveAttribute('target');
  });
});
