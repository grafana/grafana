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


export function ExploreMapPanelContent({ exploreId }: ExploreMapPanelContentProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [isInitialized, setIsInitialized] = useState(false);

  // Create scoped event bus for this panel
  const eventBus = useMemo(() => new EventBusSrv(), []);

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
    <div className={styles.container}>
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
