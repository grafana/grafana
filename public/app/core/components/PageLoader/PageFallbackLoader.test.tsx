import { screen } from '@testing-library/react';
import { getWrapper, render } from 'test/test-utils';

import { StPodReadyService, StPodStatus } from 'app/core/services/StPodReadyService';
import { configureStore } from 'app/store/configureStore';

import { AppChromeService } from '../AppChrome/AppChromeService';

import { PageFallbackLoader } from './PageFallbackLoader';

describe('PageFallbackLoader', () => {
  it('renders the default single-step loading state', () => {
    render(<PageFallbackLoader />);

    expect(screen.getByTestId('page-fallback-loader')).toBeInTheDocument();
    expect(screen.getByText('Preparing page')).toBeInTheDocument();
  });

  it('renders the dot-field backdrop', () => {
    render(<PageFallbackLoader />);

    expect(screen.getByTestId('page-fallback-dotfield')).toBeInTheDocument();
  });

  it('exposes the loading progress as a polite live region', () => {
    render(<PageFallbackLoader />);

    const status = screen.getByRole('status', { name: 'Page loading progress' });
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('accepts custom steps and renders every label', () => {
    render(
      <PageFallbackLoader
        steps={[
          { id: 'a', label: 'Alpha', done: true },
          { id: 'b', label: 'Beta', done: false },
          { id: 'c', label: 'Gamma', done: false },
        ]}
      />
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('renders a check-circle for done steps and no check-circle for pending steps', () => {
    render(
      <PageFallbackLoader
        steps={[
          { id: 'a', label: 'Alpha', done: true },
          { id: 'b', label: 'Beta', done: false },
        ]}
      />
    );

    expect(screen.getAllByTestId('icon-check-circle')).toHaveLength(1);
  });

  it('hides the decorative dot-field backdrop from assistive tech', () => {
    render(<PageFallbackLoader />);

    expect(screen.getByTestId('page-fallback-dotfield')).toHaveAttribute('aria-hidden', 'true');
  });

  it('clears the chrome default chromeless state on mount', () => {
    const chrome = new AppChromeService();
    expect(chrome.state.getValue().chromeless).toBe(true);

    const wrapper = getWrapper({ grafanaContext: { chrome }, renderWithRouter: true });
    render(<PageFallbackLoader />, { wrapper });

    expect(chrome.state.getValue().chromeless).toBeFalsy();
  });

  it('uses the nav tree title for the current pathname in the step label', () => {
    const preloadedState = {
      navBarTree: [
        {
          id: 'explore',
          text: 'Explore',
          url: '/explore',
        },
      ],
    };
    render(<PageFallbackLoader />, {
      preloadedState,
      historyOptions: { initialEntries: ['/explore'] },
    });

    expect(screen.getByText('Preparing Explore')).toBeInTheDocument();
  });

  it('falls back to the generic label when no nav item matches the pathname', () => {
    const preloadedState = {
      navBarTree: [{ id: 'explore', text: 'Explore', url: '/explore' }],
    };
    render(<PageFallbackLoader />, {
      preloadedState,
      historyOptions: { initialEntries: ['/some-unknown-page'] },
    });

    expect(screen.getByText('Preparing page')).toBeInTheDocument();
  });

  it('populates chrome section/page nav from the matched nav item so breadcrumbs render', () => {
    const chrome = new AppChromeService();
    const store = configureStore({
      navBarTree: [{ id: 'explore', text: 'Explore', url: '/explore' }],
      navIndex: {
        explore: { id: 'explore', text: 'Explore', url: '/explore' },
      },
    });
    const wrapper = getWrapper({
      store,
      grafanaContext: { chrome },
      renderWithRouter: true,
      historyOptions: { initialEntries: ['/explore'] },
    });
    render(<PageFallbackLoader />, { wrapper });

    const state = chrome.state.getValue();
    expect(state.sectionNav.node.text).toBe('Explore');
    expect(state.pageNav?.text).toBe('Explore');
  });

  it('does not render the timeout banner while the pod is still being probed', () => {
    render(<PageFallbackLoader />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a timeout banner over the loader when the pod ready service reports timeout', () => {
    const stPodReady = new StPodReadyService();
    stPodReady.state.next(StPodStatus.Timeout);
    const wrapper = getWrapper({ grafanaContext: { stPodReady }, renderWithRouter: true });

    render(<PageFallbackLoader />, { wrapper });

    expect(screen.getByRole('alert')).toHaveTextContent('Taking longer than expected');
  });

  it('skips chrome breadcrumbs when the matched item has no entry in navIndex', () => {
    // Items from navBarTree may be absent from navIndex (bookmarks, starred, runtime-added
    // entries). getNavModel's fallback would otherwise write "Page not found" into chrome state.
    const chrome = new AppChromeService();
    const store = configureStore({
      navBarTree: [{ id: 'bookmarked-thing', text: 'Bookmarked', url: '/bookmarked-thing' }],
      navIndex: {},
    });
    const wrapper = getWrapper({
      store,
      grafanaContext: { chrome },
      renderWithRouter: true,
      historyOptions: { initialEntries: ['/bookmarked-thing'] },
    });
    render(<PageFallbackLoader />, { wrapper });

    const state = chrome.state.getValue();
    expect(state.pageNav).toBeUndefined();
    expect(state.sectionNav.node.text).not.toBe('Page not found');
  });
});
