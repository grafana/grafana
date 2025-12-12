// Libraries
import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Alert, Box, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageRouteParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types/dashboard';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { DashboardScene } from '../scene/DashboardScene';
import { SoloPanelContextProvider, useDefineSoloPanelContext } from '../scene/SoloPanelContext';

import { SoloPanelPageLogo } from './SoloPanelPageLogo';

export interface Props extends GrafanaRouteComponentProps<DashboardPageRouteParams, { panelId: string }> {}

/**
 * Used for iframe embedding and image rendering of single panels
 */
export function SoloPanelPage({ queryParams }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, loadError } = stateManager.useState();
  const { uid = '', type, slug } = useParams();

  useEffect(() => {
    stateManager.loadDashboard({ uid, type, slug, route: DashboardRoutes.Embedded });
    return () => stateManager.clearState();
  }, [stateManager, queryParams, uid, type, slug]);

  if (!queryParams.panelId) {
    return <EntityNotFound entity="Panel" />;
  }

  if (loadError) {
    return (
      <Box justifyContent={'center'} alignItems={'center'} display={'flex'} height={'100%'}>
        <Alert severity="error" title={t('dashboard.errors.failed-to-load', 'Failed to load dashboard')}>
          {loadError.message}
        </Alert>
      </Box>
    );
  }

  if (!dashboard) {
    return <PageLoader />;
  }

  return (
    <UrlSyncContextProvider scene={dashboard}>
      <SoloPanelRenderer dashboard={dashboard} panelId={queryParams.panelId} />
    </UrlSyncContextProvider>
  );
}

export default SoloPanelPage;

export function SoloPanelRenderer({ dashboard, panelId }: { dashboard: DashboardScene; panelId: string }) {
  const { controls, body } = dashboard.useState();
  const refreshPicker = controls?.useState()?.refreshPicker;
  const styles = useStyles2(getStyles);
  const soloPanelContext = useDefineSoloPanelContext(panelId)!;
  const [isHovered, setIsHovered] = useState(false);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dashDeactivate = dashboard.activate();
    const refreshDeactivate = refreshPicker?.activate();

    return () => {
      dashDeactivate();
      refreshDeactivate?.();
    };
  }, [dashboard, refreshPicker]);

  // Calculate responsive scale based on panel dimensions
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) {
        return;
      }

      const { width, height } = containerRef.current.getBoundingClientRect();
      // Use the smaller dimension to ensure it scales appropriately for both wide and tall panels
      const minDimension = Math.min(width, height);

      // Base scale calculation: scale between 0.6 (for small panels ~200px) and 1.0 (for large panels ~800px+)
      // Allow scaling up to 1.0 for larger panels
      const baseScale = Math.max(0.6, Math.min(1.0, 0.6 + (minDimension - 200) / 600));

      // Also consider width specifically for very wide but short panels
      const widthScale = Math.max(0.6, Math.min(1.0, 0.6 + (width - 200) / 800));

      // Use the average of both for balanced scaling, ensuring we reach 1.0 for large panels
      const finalScale = Math.min(1.0, (baseScale + widthScale) / 2);
      setScale(finalScale);
    };

    updateScale();

    const resizeObserver = new ResizeObserver(updateScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SoloPanelPageLogo scale={scale} isHovered={isHovered} />
      {renderHiddenVariables(dashboard)}
      <div className={styles.panelWrapper}>
        <SoloPanelContextProvider value={soloPanelContext} dashboard={dashboard} singleMatch={true}>
          <body.Component model={body} />
        </SoloPanelContextProvider>
      </div>
    </div>
  );
}

// Some variables like ScopesVariable needs
// to be rendered for their logic to work even if hidden
function renderHiddenVariables(dashboard: DashboardScene) {
  if (!dashboard.state.$variables) {
    return null;
  }

  const variables = dashboard.state.$variables.state.variables;

  return (
    <>
      {variables.map((variable) => {
        if (variable.UNSAFE_renderAsHidden) {
          return <variable.Component model={variable} key={variable.state.key} />;
        }

        return null;
      })}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const panelWrapper = css({
    width: '100%',
    height: '100%',
  });

  return {
    container: css({
      position: 'fixed',
      bottom: 0,
      right: 0,
      margin: 0,
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
    }),
    panelWrapper,
  };
};
