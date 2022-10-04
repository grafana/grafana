import { useEffect, useMemo } from 'react';
import { BehaviorSubject } from 'rxjs';

import { config } from '@grafana/runtime';
import { useForceUpdate } from '@grafana/ui';
import store from 'app/core/store';

export interface PageState {
  isNavExpanded: boolean;
}

export function usePageState() {
  const { state, actions } = useMemo(() => {
    const isSmallScreenQuery = window.matchMedia(`(max-width: ${config.theme2.breakpoints.values.lg}px)`);
    const navExpandedPreference = store.getBool('grafana.sectionNav.expanded', true);

    const state = new BehaviorSubject<PageState>({
      isNavExpanded: !isSmallScreenQuery.matches && navExpandedPreference,
    });

    // Subscribe to watch
    const onMediaQueryChange = (e: MediaQueryListEvent) => {
      state.next({ isNavExpanded: e.matches ? false : store.getBool('grafana.sectionNav.expanded', true) });
    };

    const onInit = () => {
      isSmallScreenQuery.addEventListener('change', onMediaQueryChange);
    };

    const onCleanUp = () => {
      isSmallScreenQuery.removeEventListener('change', onMediaQueryChange);
    };

    const onToggleSectionNav = () => {
      const { isNavExpanded } = state.getValue();
      state.next({ isNavExpanded: !isNavExpanded });
    };

    return { state, actions: { onToggleSectionNav, onInit, onCleanUp } };
  }, []);

  useEffect(() => {
    actions.onInit();
    return () => actions.onCleanUp();
  }, [actions]);

  const latestState = useLatestState(state);

  return { state: latestState, actions };
}

export function useLatestState<TState>(state: BehaviorSubject<TState>): TState {
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    const s = state.subscribe(forceUpdate);
    return () => s.unsubscribe();
  }, [state, forceUpdate]);

  return state.getValue();
}
