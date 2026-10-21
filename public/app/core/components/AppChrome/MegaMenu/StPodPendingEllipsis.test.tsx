import { act, render, screen } from 'test/test-utils';

import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { invalidateStPodReadiness, markStPodReady, markStPodTimeout } from 'app/core/navigation/stPodReadiness';

import { StPodPendingEllipsis } from './StPodPendingEllipsis';

jest.mock('app/core/navigation/STPodHealthPoller', () => ({
  STPodHealthPoller: () => null,
}));

describe('StPodPendingEllipsis', () => {
  beforeEach(async () => {
    invalidateStPodReadiness();
    await act(async () => {
      setTestFlags({ [FlagKeys.GrafanaMtFallback]: { allowList: ['/dashboards'] } });
    });
  });

  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it('shows an ellipsis for a url outside the allow list while the pod is starting', () => {
    render(<StPodPendingEllipsis url="/explore" />);

    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it.each([
    ['an allow-listed path', '/dashboards'],
    ['an allow-listed path with a query string', '/dashboards?orgId=1'],
    ['an allow-listed path with a hash', '/dashboards#top'],
  ])('shows nothing for %s', (_, url) => {
    const { container } = render(<StPodPendingEllipsis url={url} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['the pod is ready', markStPodReady],
    ['waiting for the pod times out', markStPodTimeout],
  ])('removes the ellipsis once %s', (_, settle) => {
    render(<StPodPendingEllipsis url="/explore" />);
    expect(screen.getByText('...')).toBeInTheDocument();

    act(() => settle());

    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  it('brings the ellipsis back when a timed-out pod is invalidated while mounted', () => {
    render(<StPodPendingEllipsis url="/explore" />);
    act(() => markStPodTimeout());
    expect(screen.queryByText('...')).not.toBeInTheDocument();

    act(() => invalidateStPodReadiness());

    expect(screen.getByText('...')).toBeInTheDocument();
  });
});
