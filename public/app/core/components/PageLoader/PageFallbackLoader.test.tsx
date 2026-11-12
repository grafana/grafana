import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { combineReducers, configureStore as reduxConfigureStore, type ReducersMapObject } from '@reduxjs/toolkit';
import { render as rtlRender, screen, type RenderOptions } from '@testing-library/react';
import { createMemoryHistory, type MemoryHistoryBuildOptions } from 'history';
import { type PropsWithChildren, type ReactElement } from 'react';
import { Provider } from 'react-redux';
// eslint-disable-next-line no-restricted-imports
import { Router } from 'react-router-dom';
import { CompatRouter } from 'react-router-dom-v5-compat';

import { HistoryWrapper, setChromeHeaderHeightHook, setLocationService } from '@grafana/runtime';
import { getTestFeatureFlagClient } from '@grafana/test-utils/feature-flags';
import { GrafanaContext, type GrafanaContextType } from 'app/core/context/GrafanaContext';
import { navTreeReducer } from 'app/core/reducers/navBarTree';
import { buildInitialState, navIndexReducer } from 'app/core/reducers/navModel';
import { StPodReadyService, StPodStatus } from 'app/core/services/StPodReadyService';
import { useStarredSearch } from 'app/features/stars/hooks';
import { type StoreState } from 'app/types/store';

import { AppChromeService } from '../AppChrome/AppChromeService';

import { PageFallbackLoader } from './PageFallbackLoader';

jest.mock('app/features/stars/hooks', () => ({
  useStarredSearch: jest.fn(),
}));

type NavigationState = Pick<StoreState, 'navBarTree' | 'navIndex'>;

function configureStore(preloadedState?: Partial<NavigationState>) {
  return reduxConfigureStore({
    reducer: combineReducers<ReducersMapObject<NavigationState>>({
      navBarTree: navTreeReducer,
      navIndex: navIndexReducer,
    }),
    preloadedState: { navIndex: buildInitialState(), ...preloadedState },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
  });
}

interface WrapperOptions {
  store?: ReturnType<typeof configureStore>;
  grafanaContext?: Partial<Pick<GrafanaContextType, 'chrome' | 'stPodReady'>>;
  historyOptions?: MemoryHistoryBuildOptions;
}

function getWrapper({ store = configureStore(), grafanaContext, historyOptions }: WrapperOptions = {}) {
  const location = new HistoryWrapper(createMemoryHistory(historyOptions));
  setLocationService(location);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Page and its loader only consume these two services.
  const context = {
    chrome: new AppChromeService(),
    stPodReady: new StPodReadyService(),
    ...grafanaContext,
  } as GrafanaContextType;

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <Provider store={store}>
        <OpenFeatureProvider client={getTestFeatureFlagClient()}>
          <GrafanaContext.Provider value={context}>
            <Router history={location.getHistory()}>
              <CompatRouter>{children}</CompatRouter>
            </Router>
          </GrafanaContext.Provider>
        </OpenFeatureProvider>
      </Provider>
    );
  };
}

function render(
  ui: ReactElement,
  {
    wrapper,
    preloadedState,
    ...options
  }: WrapperOptions &
    Pick<RenderOptions, 'wrapper'> & {
      preloadedState?: Partial<NavigationState>;
    } = {}
) {
  setChromeHeaderHeightHook(() => 40);
  return rtlRender(ui, {
    wrapper: wrapper ?? getWrapper({ store: configureStore(preloadedState), ...options }),
  });
}

describe('PageFallbackLoader', () => {
  beforeEach(() => {
    jest.mocked(useStarredSearch).mockReturnValue({
      rows: [],
      loading: false,
      error: false,
      refetch: jest.fn(),
    });
  });

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

    const wrapper = getWrapper({ grafanaContext: { chrome } });
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

  it('uses a starred search result for the current pathname in the step label', () => {
    jest.mocked(useStarredSearch).mockReturnValue({
      rows: [
        {
          kind: 'dashboard',
          uid: 'starred-dashboard',
          name: 'Starred dashboard',
          url: '/d/starred-dashboard',
          panel_type: '',
          tags: [],
          location: '',
          ds_uid: [],
        },
      ],
      loading: false,
      error: false,
      refetch: jest.fn(),
    });

    render(<PageFallbackLoader />, {
      preloadedState: { navBarTree: [{ id: 'starred', text: 'Starred', children: [] }] },
      historyOptions: { initialEntries: ['/d/starred-dashboard'] },
    });

    expect(screen.getByText('Preparing Starred dashboard')).toBeInTheDocument();
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
      historyOptions: { initialEntries: ['/explore'] },
    });
    render(<PageFallbackLoader />, { wrapper });

    const state = chrome.state.getValue();
    expect(state.sectionNav.node.text).toBe('Explore');
    expect(state.pageNav?.text).toBe('Explore');
  });

  it('does not render the timeout banner or error card while the pod is still being probed', () => {
    render(<PageFallbackLoader />);

    expect(screen.queryByTestId('st-pod-timeout-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('st-pod-error-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('page-fallback-loader')).toBeInTheDocument();
  });

  it('renders the hang-tight banner alongside the loader when the pod ready service reports timeout', () => {
    const stPodReady = new StPodReadyService();
    stPodReady.state.next(StPodStatus.Timeout);
    const wrapper = getWrapper({ grafanaContext: { stPodReady } });

    render(<PageFallbackLoader />, { wrapper });

    expect(screen.getByTestId('st-pod-timeout-banner')).toHaveTextContent(
      "Hang tight. This is taking a bit longer than expected, but we're on it."
    );
    expect(screen.getByTestId('page-fallback-loader')).toBeInTheDocument();
    expect(screen.getByTestId('page-fallback-dotfield')).toBeInTheDocument();
    expect(screen.queryByTestId('st-pod-error-card')).not.toBeInTheDocument();
  });

  it('renders the error card with the matched page title when the pod ready service reports error', () => {
    const stPodReady = new StPodReadyService();
    stPodReady.state.next(StPodStatus.Error);
    const store = configureStore({ navBarTree: [{ id: 'explore', text: 'Explore', url: '/explore' }] });
    const wrapper = getWrapper({
      store,
      grafanaContext: { stPodReady },
      historyOptions: { initialEntries: ['/explore'] },
    });

    render(<PageFallbackLoader />, { wrapper });

    const card = screen.getByTestId('st-pod-error-card');
    expect(card).toHaveTextContent("Couldn't load Explore");
    expect(card).toHaveTextContent('Something went wrong while this was starting up.');
    expect(card).toHaveTextContent("If you've already reached out, we have your request and we're on it.");
    expect(screen.getByRole('link', { name: /support@grafana\.com/ })).toHaveAttribute(
      'href',
      'mailto:support@grafana.com'
    );
    expect(screen.queryByTestId('page-fallback-loader')).not.toBeInTheDocument();
    expect(screen.queryByTestId('page-fallback-dotfield')).not.toBeInTheDocument();
    expect(screen.queryByTestId('st-pod-timeout-banner')).not.toBeInTheDocument();
  });

  it('falls back to the generic error title when no nav item matches the pathname', () => {
    const stPodReady = new StPodReadyService();
    stPodReady.state.next(StPodStatus.Error);
    const wrapper = getWrapper({
      grafanaContext: { stPodReady },
      historyOptions: { initialEntries: ['/some-unknown-page'] },
    });

    render(<PageFallbackLoader />, { wrapper });

    expect(screen.getByTestId('st-pod-error-card')).toHaveTextContent("Couldn't load page");
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
      historyOptions: { initialEntries: ['/bookmarked-thing'] },
    });
    render(<PageFallbackLoader />, { wrapper });

    const state = chrome.state.getValue();
    expect(state.pageNav).toBeUndefined();
    expect(state.sectionNav.node.text).not.toBe('Page not found');
  });
});
