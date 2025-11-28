import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { EventBusSrv, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { ExplorePaneContainer } from '../../explore/ExplorePaneContainer';
import { DEFAULT_RANGE } from '../../explore/state/constants';
import { initializeExplore } from '../../explore/state/explorePane';

interface ExploreMapPanelContentProps {
  exploreId: string;
  width: number;
  height: number;
}


// Patch getBoundingClientRect to fix AutoSizer measurements with CSS transforms
// Store original function
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
let isPatched = false;

function patchGetBoundingClientRect() {
  if (isPatched) {
    return;
  }

  Element.prototype.getBoundingClientRect = function (this: Element) {
    const result = originalGetBoundingClientRect.call(this);

    // Very conservative: only patch if this is an HTMLElement with offsetWidth available
    // and it's inside a transformed container
    if (!(this instanceof HTMLElement)) {
      return result;
    }

    // Check if we should use offsetWidth by looking at the stack trace
    // This is hacky but safer than checking DOM position which can fail
    try {
      // Only apply fix if called from AutoSizer context
      const stack = new Error().stack || '';
      const isFromAutoSizer = stack.includes('AutoSizer') || stack.includes('_onResize');

      if (!isFromAutoSizer) {
        return result;
      }

      // Check if this element has transforms applied
      let element: Element | null = this;
      while (element) {
        const style = window.getComputedStyle(element);
        if (style.transform && style.transform !== 'none') {
          // Use offsetWidth which is not affected by transforms
          return new DOMRect(
            result.left,
            result.top,
            this.offsetWidth,
            this.offsetHeight
          );
        }
        element = element.parentElement;
      }
    } catch (e) {
      // If anything fails, return original result
      return result;
    }

    return result;
  };

  isPatched = true;
}

export function ExploreMapPanelContent({ exploreId, width, height }: ExploreMapPanelContentProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [isInitialized, setIsInitialized] = useState(false);

  // Create scoped event bus for this panel
  const eventBus = useMemo(() => new EventBusSrv(), []);

  // Patch getBoundingClientRect on mount
  useEffect(() => {
    patchGetBoundingClientRect();
  }, []);

  // Check if the explore pane exists in Redux
  const explorePane = useSelector((state) => state.explore?.panes?.[exploreId]);

  // Find the panel with this exploreId to get saved state
  const panel = useSelector((state) =>
    Object.values(state.exploreMap.panels).find((p) => p.exploreId === exploreId)
  );

  // Initialize Explore pane on mount
  useEffect(() => {
    const initializePane = async () => {
      // Use saved state if available, otherwise defaults
      const savedState = panel?.exploreState;

      await dispatch(
        initializeExplore({
          exploreId,
          datasource: savedState?.datasourceUid,
          queries: savedState?.queries || [],
          range: savedState?.range || DEFAULT_RANGE,
          eventBridge: eventBus,
          compact: savedState?.compact || false,
        })
      );
      setIsInitialized(true);
    };

    initializePane();

    // Cleanup on unmount
    return () => {
      eventBus.removeAllListeners();
    };
  }, [dispatch, exploreId, eventBus, panel?.exploreState]);

  // Wait for Redux state to be initialized
  if (!isInitialized || !explorePane) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Trans i18nKey="explore-map.panel.initializing">Initializing Explore...</Trans>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.container}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <ExplorePaneContainer exploreId={exploreId} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      position: 'relative',

      // Override Explore styles to fit in panel
      '& .explore-container': {
        padding: 0,
        height: '100%',
      },
    }),
    loading: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
    }),
  };
};
