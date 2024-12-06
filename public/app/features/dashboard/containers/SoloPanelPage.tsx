import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useParams } from 'react-router-dom-v5-compat';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, useStyles2 } from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { StoreState } from 'app/types';

import { useGrafana } from '../../../core/context/GrafanaContext';
import { DashboardPanel } from '../dashgrid/DashboardPanel';
import { initDashboard } from '../state/initDashboard';

export interface DashboardPageRouteParams {
  uid?: string;
  type?: string;
  slug?: string;
}

const mapStateToProps = (state: StoreState) => ({
  dashboard: state.dashboard.getModel(),
});

const mapDispatchToProps = {
  initDashboard,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = GrafanaRouteComponentProps<DashboardPageRouteParams, { panelId: string; timezone?: string }> &
  ConnectedProps<typeof connector>;

export interface State {
  panel: PanelModel | null;
  notFound: boolean;
}

export const SoloPanelPage = ({ route, queryParams, dashboard, initDashboard }: Props) => {
  const [panel, setPanel] = useState<State['panel']>(null);
  const [notFound, setNotFound] = useState(false);
  const { keybindings } = useGrafana();

  const { slug, uid, type } = useParams();

  useEffect(() => {
    initDashboard({
      urlSlug: slug,
      urlUid: uid,
      urlType: type,
      routeName: route.routeName,
      fixUrl: false,
      keybindingSrv: keybindings,
    });
  }, [slug, uid, type, route.routeName, initDashboard, keybindings]);

  const getPanelId = useCallback(() => {
    return parseInt(queryParams.panelId ?? '0', 10);
  }, [queryParams.panelId]);

  useEffect(() => {
    if (dashboard) {
      const panel = dashboard.getPanelByUrlId(queryParams.panelId);

      if (!panel) {
        setNotFound(true);
        return;
      }

      if (panel) {
        dashboard.exitViewPanel(panel);
      }
      setPanel(panel);
      dashboard.initViewPanel(panel);
    }
  }, [dashboard, queryParams.panelId]);

  return (
    <SoloPanel
      dashboard={dashboard}
      notFound={notFound}
      panel={panel}
      panelId={getPanelId()}
      timezone={queryParams.timezone}
    />
  );
};

export interface SoloPanelProps extends State {
  dashboard: DashboardModel | null;
  panelId: number;
  timezone?: string;
}

export const SoloPanel = ({ dashboard, notFound, panel, panelId, timezone }: SoloPanelProps) => {
  const styles = useStyles2(getStyles);
  if (notFound) {
    return <Alert severity="error" title={`Panel with id ${panelId} not found`} />;
  }

  if (!panel || !dashboard) {
    return <div>Loading & initializing dashboard</div>;
  }

  return (
    <div className={styles.container}>
      <AutoSizer>
        {({ width, height }) => {
          if (width === 0) {
            return null;
          }
          return (
            <DashboardPanel
              stateKey={panel.key}
              width={width}
              height={height}
              dashboard={dashboard}
              panel={panel}
              isEditing={false}
              isViewing={true}
              lazy={false}
              timezone={timezone}
              hideMenu={true}
            />
          );
        }}
      </AutoSizer>
    </div>
  );
};

export default connector(SoloPanelPage);

const getStyles = (theme: GrafanaTheme2) => ({
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
});
