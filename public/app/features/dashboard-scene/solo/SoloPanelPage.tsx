// Libraries
import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Alert, Box, useStyles2, useTheme2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageRouteParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types/dashboard';
import grafanaTextLogoDarkSvg from 'img/grafana_text_logo_dark.svg';
import grafanaTextLogoLightSvg from 'img/grafana_text_logo_light.svg';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { DashboardScene } from '../scene/DashboardScene';
import { SoloPanelContextProvider, useDefineSoloPanelContext } from '../scene/SoloPanelContext';

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
  const theme = useTheme2();
  const soloPanelContext = useDefineSoloPanelContext(panelId)!;
  const [isHovered, setIsHovered] = useState(false);

  const grafanaLogo = theme.isDark ? grafanaTextLogoLightSvg : grafanaTextLogoDarkSvg;

  useEffect(() => {
    const dashDeactivate = dashboard.activate();
    const refreshDeactivate = refreshPicker?.activate();

    return () => {
      dashDeactivate();
      refreshDeactivate?.();
    };
  }, [dashboard, refreshPicker]);

  return (
    <div className={styles.container} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className={cx(styles.logoContainer, isHovered && styles.logoHidden)}>
        <span className={styles.text}>
          <Trans i18nKey="embedded-panel.powered-by">Powered by</Trans>
        </span>
        <img src={grafanaLogo} alt="Grafana" className={styles.logo} />
      </div>
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
  const logoContainer = css({
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    padding: theme.spacing(0.75, 1),
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    opacity: 0.9,
    pointerEvents: 'none',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    boxShadow: theme.shadows.z3,
    border: `1px solid ${theme.colors.border.weak}`,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'opacity 0.2s ease-in-out',
    },
  });

  const logoHidden = css({
    opacity: 0,
  });

  const text = css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
  });

  const logo = css({
    height: '16px',
    marginLeft: theme.spacing(0.5),
    display: 'block',
  });

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
    logoContainer,
    logoHidden,
    text,
    logo,
  };
};
