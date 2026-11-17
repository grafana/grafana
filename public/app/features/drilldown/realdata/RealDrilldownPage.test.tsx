import { act, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { RealDrilldownPage } from './RealDrilldownPage';
import { type Hint, type ScopeData, type ServiceSummary, setOverview } from './liveScenario';
import { loadScope } from './loadScenario';
import { emptyOverview, emptyScopeData } from './testFixtures';

jest.mock('./loadScenario', () => ({ loadScope: jest.fn() }));

const service = (name: string): ServiceSummary => ({
  name,
  health: 'healthy',
  p95: 'n/a',
  errorRate: 'n/a',
  trend: [],
  lastDeploy: '',
});

const checkoutHint: Hint = {
  id: 'errors-checkout',
  severity: 'errors',
  title: 'checkout errors are up',
  description: 'span_errors on checkout',
  scope: { type: 'service', value: 'checkout' },
  investigable: true,
  trendLabel: 'errors',
  trend: [1, 2, 3],
};

const scopeData = (namespace: string): ScopeData => ({
  ...emptyScopeData,
  detectionSteps: [{ app: 'metrics', finding: 'p95 is 3x the hour before' }],
  detectedScope: { namespace, since: '30 minutes', likelyCause: 'A new version raised the error rate.' },
});

// A load the test answers by hand, so the answer can arrive after the user has moved on.
function pendingLoad() {
  let answer: (data: ScopeData) => void = () => {};
  const promise = new Promise<ScopeData>((resolve) => {
    answer = resolve;
  });
  return { promise, answer: (data: ScopeData) => answer(data) };
}

const renderPage = (url = '/drilldown') => render(<RealDrilldownPage />, { historyOptions: { initialEntries: [url] } });

const search = () => locationService.getSearchObject();

const goBack = () =>
  act(() => {
    locationService.getHistory().goBack();
  });

const goForward = () =>
  act(() => {
    locationService.getHistory().goForward();
  });

beforeEach(() => {
  setOverview({
    ...emptyOverview,
    hints: [checkoutHint],
    services: [service('cart'), service('checkout')],
    scopeValues: { service: ['cart', 'checkout'], environment: [], namespace: ['shop'] },
  });
  jest.mocked(loadScope).mockResolvedValue(scopeData('shop'));
});

afterEach(() => {
  jest.mocked(loadScope).mockReset();
  setOverview(emptyOverview);
});

describe('RealDrilldownPage', () => {
  it('shows the data sources button beside the heading', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Drilldown' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data sources' })).toBeInTheDocument();
  });

  it('writes a picked service to the URL and loads its scope', async () => {
    const { user } = renderPage();

    await user.click(screen.getByRole('button', { name: /^cart/ }));

    expect(await screen.findByText('Scope')).toBeInTheDocument();
    expect(search()).toMatchObject({ 'scope-type': 'service', 'scope-value': 'cart' });
    expect(search()).not.toHaveProperty('hint');
    expect(loadScope).toHaveBeenCalledTimes(1);
    expect(loadScope).toHaveBeenCalledWith({ type: 'service', value: 'cart' }, expect.any(Number), expect.any(Number));
  });

  it('returns to the overview on Back and to the scope on Forward', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: /^cart/ }));
    expect(await screen.findByText('Scope')).toBeInTheDocument();

    goBack();

    expect(await screen.findByRole('heading', { name: 'Your services' })).toBeInTheDocument();
    expect(screen.queryByText('Scope')).not.toBeInTheDocument();
    expect(search()).not.toHaveProperty('scope-type');

    goForward();

    expect(await screen.findByText('Scope')).toBeInTheDocument();
    expect(search()).toMatchObject({ 'scope-type': 'service', 'scope-value': 'cart' });
    expect(loadScope).toHaveBeenCalledTimes(2);
  });

  it('opens the scope the URL names on load', async () => {
    renderPage('/drilldown?scope-type=namespace&scope-value=shop');

    expect(await screen.findByText('Scope')).toBeInTheDocument();
    expect(loadScope).toHaveBeenCalledTimes(1);
    expect(loadScope).toHaveBeenCalledWith(
      { type: 'namespace', value: 'shop' },
      expect.any(Number),
      expect.any(Number)
    );
    expect(screen.queryByRole('heading', { name: 'Your services' })).not.toBeInTheDocument();
  });

  it('shows the overview when the URL names a scope type the page does not know', () => {
    renderPage('/drilldown?scope-type=cluster&scope-value=shop');

    expect(screen.getByRole('heading', { name: 'Your services' })).toBeInTheDocument();
    expect(loadScope).not.toHaveBeenCalled();
  });

  it('ignores a hint in the URL that belongs to another scope', async () => {
    renderPage('/drilldown?scope-type=service&scope-value=cart&hint=errors-checkout');

    expect(await screen.findByText('Scope')).toBeInTheDocument();
    expect(screen.queryByText('Scope chosen by Grafana Assistant')).not.toBeInTheDocument();
  });

  it('plays the detection step for Investigate, and Back returns to the overview', async () => {
    const { user } = renderPage();

    await user.click(screen.getByRole('button', { name: 'Investigate' }));

    expect(await screen.findByText('Checking…')).toBeInTheDocument();
    expect(search()).toMatchObject({ 'scope-type': 'service', 'scope-value': 'checkout', hint: 'errors-checkout' });

    goBack();

    expect(await screen.findByRole('button', { name: 'Investigate' })).toBeInTheDocument();
    expect(screen.queryByText('Checking…')).not.toBeInTheDocument();
  });

  it('goes straight to the insights with the hint when the browser replays the Investigate URL', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Investigate' }));
    await screen.findByText('Checking…');
    goBack();
    await screen.findByRole('button', { name: 'Investigate' });

    goForward();

    // Whichever of the two appears first shows if the detection step played, since it ends on its own after a pause.
    await screen.findByText(/Checking…|Scope chosen by Grafana Assistant/);
    expect(screen.queryByText('Checking…')).not.toBeInTheDocument();
    expect(screen.getByText('Scope chosen by Grafana Assistant')).toBeInTheDocument();
  });

  it('leaves the scope with Back to overview, and Back then returns to the scope', async () => {
    const { user } = renderPage('/drilldown?scope-type=service&scope-value=cart');

    await user.click(await screen.findByRole('button', { name: 'Back to overview' }));

    expect(await screen.findByRole('heading', { name: 'Your services' })).toBeInTheDocument();
    expect(search()).not.toHaveProperty('scope-type');

    goBack();

    expect(await screen.findByText('Scope')).toBeInTheDocument();
    expect(search()).toMatchObject({ 'scope-type': 'service', 'scope-value': 'cart' });
  });

  it('shows the error and takes the scope out of the URL when the scope fails to load', async () => {
    jest.mocked(loadScope).mockRejectedValue(new Error('Prometheus answered 502'));
    const { user } = renderPage();

    await user.click(screen.getByRole('button', { name: /^cart/ }));

    expect(await screen.findByText('Prometheus answered 502')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your services' })).toBeInTheDocument();
    expect(search()).not.toHaveProperty('scope-type');
  });

  it('stays on the overview when Back is pressed before the scope has loaded', async () => {
    const cart = pendingLoad();
    jest.mocked(loadScope).mockReturnValueOnce(cart.promise);
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: /^cart/ }));
    expect(await screen.findByText('Grafana Assistant is checking cart')).toBeInTheDocument();

    goBack();
    await act(async () => {
      cart.answer(scopeData('shop'));
    });

    expect(screen.getByRole('heading', { name: 'Your services' })).toBeInTheDocument();
    expect(screen.queryByText('Scope')).not.toBeInTheDocument();
  });

  it('keeps the data of the scope on show when a slow answer for the scope before arrives late', async () => {
    const cart = pendingLoad();
    jest.mocked(loadScope).mockReturnValueOnce(cart.promise);
    jest.mocked(loadScope).mockResolvedValueOnce(scopeData('beta'));
    renderPage('/drilldown?scope-type=service&scope-value=cart');

    act(() => {
      locationService.partial({ 'scope-value': 'checkout' });
    });
    expect(await screen.findByText('service.namespace = beta')).toBeInTheDocument();
    await act(async () => {
      cart.answer(scopeData('alpha'));
    });

    expect(screen.getByText('service.namespace = beta')).toBeInTheDocument();
    expect(screen.queryByText('service.namespace = alpha')).not.toBeInTheDocument();
  });
});
