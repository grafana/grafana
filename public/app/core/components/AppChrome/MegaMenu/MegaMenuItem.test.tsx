import { act, render, screen } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { invalidateStPodReadiness, markStPodReady, markStPodTimeout } from 'app/core/navigation/stPodReadiness';

import { MegaMenuItem } from './MegaMenuItem';

jest.mock('app/core/navigation/STPodHealthPoller', () => ({
  STPodHealthPoller: () => null,
}));

const DOTS_SELECTOR = '.st-pod-dots';

const notAllowed: NavModelItem = { text: 'Explore', url: '/explore', id: 'explore' };
const allowed: NavModelItem = { text: 'Dashboards', url: '/dashboards', id: 'dashboards' };

const renderItem = (link: NavModelItem, activeItem?: NavModelItem) =>
  render(
    <ul>
      <MegaMenuItem link={link} activeItem={activeItem} onPin={() => {}} isPinned={() => false} />
    </ul>
  );

describe('MegaMenuItem ST pod loading indicator', () => {
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

  it('shows dots next to an item that is not allowlisted while the pod is starting', () => {
    const { container } = renderItem(notAllowed);

    expect(screen.getByRole('link', { name: /Explore/ })).toBeInTheDocument();
    expect(container.querySelector(DOTS_SELECTOR)).toBeInTheDocument();
  });

  it('shows no dots next to an allowlisted item', () => {
    const { container } = renderItem(allowed);

    expect(screen.getByRole('link', { name: /Dashboards/ })).toBeInTheDocument();
    expect(container.querySelector(DOTS_SELECTOR)).not.toBeInTheDocument();
  });

  it('still shows the dots on the current page', () => {
    const { container } = renderItem(notAllowed, notAllowed);

    expect(screen.getByRole('link', { name: /Explore/ })).toHaveAttribute('aria-current', 'page');
    expect(container.querySelector(DOTS_SELECTOR)).toBeInTheDocument();
  });

  it.each([
    ['the pod is ready', markStPodReady],
    ['waiting for the pod times out', markStPodTimeout],
  ])('removes the dots once %s', (_, settle) => {
    const { container } = renderItem(notAllowed);
    expect(container.querySelector(DOTS_SELECTOR)).toBeInTheDocument();

    act(() => settle());

    expect(container.querySelector(DOTS_SELECTOR)).not.toBeInTheDocument();
  });

  it('brings the dots back when a timed-out pod is invalidated while the row stays mounted', () => {
    const { container } = renderItem(notAllowed);
    act(() => markStPodTimeout());
    expect(container.querySelector(DOTS_SELECTOR)).not.toBeInTheDocument();

    act(() => invalidateStPodReadiness());

    expect(container.querySelector(DOTS_SELECTOR)).toBeInTheDocument();
  });

  describe('tooltip', () => {
    it('explains the app is starting up when hovering a loading item', async () => {
      const { user } = renderItem(notAllowed);

      await user.hover(screen.getByRole('link', { name: /Explore/ }));

      expect(await screen.findByRole('tooltip')).toHaveTextContent('Explore is starting up');
    });

    it('opens on keyboard focus without adding a tab stop for the row itself', async () => {
      const { user } = renderItem(notAllowed);

      await user.tab();

      expect(screen.getByRole('link', { name: /Explore/ })).toHaveFocus();
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Explore is starting up');
    });

    it('does not open for the current page', async () => {
      const { user } = renderItem(notAllowed, notAllowed);
      const link = screen.getByRole('link', { name: /Explore/ });

      await user.hover(link);

      expect(link).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('closes when the pod becomes ready while it is open', async () => {
      const { user } = renderItem(notAllowed);
      await user.hover(screen.getByRole('link', { name: /Explore/ }));
      expect(await screen.findByRole('tooltip')).toBeInTheDocument();

      act(() => markStPodReady());

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
