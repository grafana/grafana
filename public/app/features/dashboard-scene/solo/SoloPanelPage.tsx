// Libraries
import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, UrlQueryValue } from '@grafana/data';
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

export interface Props
  extends GrafanaRouteComponentProps<DashboardPageRouteParams, { panelId: string; hideLogo?: UrlQueryValue }> {}

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
    <UrlSyncContextProvider scene={dashboard} updateUrlOnInit={true}>
      <SoloPanelRenderer dashboard={dashboard} panelId={queryParams.panelId} hideLogo={queryParams.hideLogo} />
    </UrlSyncContextProvider>
  );
}

export default SoloPanelPage;

export function SoloPanelRenderer({
  dashboard,
  panelId,
  hideLogo,
}: {
  dashboard: DashboardScene;
  panelId: string;
  hideLogo?: UrlQueryValue;
}) {
  const { controls, body } = dashboard.useState();
  const refreshPicker = controls?.useState()?.refreshPicker;
  const styles = useStyles2(getStyles);
  const soloPanelContext = useDefineSoloPanelContext(panelId)!;
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dashDeactivate = dashboard.activate();
    const refreshDeactivate = refreshPicker?.activate();

    return () => {
      dashDeactivate();
      refreshDeactivate?.();
    };
  }, [dashboard, refreshPicker]);

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SoloPanelPageLogo containerRef={containerRef} isHovered={isHovered} hideLogo={hideLogo} />
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
