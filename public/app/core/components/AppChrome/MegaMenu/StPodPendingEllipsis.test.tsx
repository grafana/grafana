import { act, getWrapper, render } from 'test/test-utils';

import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { StPodReadinessService, StPodStatus } from 'app/core/services/StPodReadinessService';

import { StPodPendingEllipsis } from './StPodPendingEllipsis';

const queryDots = () => document.querySelector('.st-pod-dots');

describe('StPodPendingEllipsis', () => {
  let service: StPodReadinessService;

  beforeEach(async () => {
    service = new StPodReadinessService();
    await act(async () => {
      setTestFlags({ [FlagKeys.GrafanaMtFallback]: { allowList: ['/dashboards'] } });
    });
  });

  afterEach(async () => {
    service.stop();
    await act(async () => {
      setTestFlags({});
    });
  });

  const renderEllipsis = (url: string) => {
    const wrapper = getWrapper({ grafanaContext: { stPodReadiness: service }, renderWithRouter: true });
    return render(<StPodPendingEllipsis url={url} />, { wrapper });
  };

  it('shows the pending dots for a url outside the allow list while the pod is starting', () => {
    renderEllipsis('/explore');

    expect(queryDots()).toBeInTheDocument();
  });

  it.each([
    ['an allow-listed path', '/dashboards'],
    ['an allow-listed path with a query string', '/dashboards?orgId=1'],
    ['an allow-listed path with a hash', '/dashboards#top'],
  ])('shows nothing for %s', (_, url) => {
    const { container } = renderEllipsis(url);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['the pod is ready', StPodStatus.Ready],
    ['waiting for the pod times out', StPodStatus.Timeout],
  ])('removes the pending dots once %s', (_, settled) => {
    renderEllipsis('/explore');
    expect(queryDots()).toBeInTheDocument();

    act(() => service.state.next(settled));

    expect(queryDots()).not.toBeInTheDocument();
  });

  it('brings the pending dots back when a timed-out pod transitions to waiting again', () => {
    renderEllipsis('/explore');
    act(() => service.state.next(StPodStatus.Timeout));
    expect(queryDots()).not.toBeInTheDocument();

    act(() => service.state.next(StPodStatus.Waiting));

    expect(queryDots()).toBeInTheDocument();
  });
});
