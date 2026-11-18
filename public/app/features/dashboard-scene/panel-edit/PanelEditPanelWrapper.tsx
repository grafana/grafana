import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';
import { SandboxConsentBanner } from '../scene/sandbox-consent/SandboxConsentBanner';
import { SoloPanelContextProvider, SoloPanelContextForPanelEdit } from '../solo/SoloPanelContext';

interface PanelEditPanelWrapperProps {
  panel: VizPanel;
  tableView?: VizPanel;
  dashboard: DashboardScene;
}

export function PanelEditPanelWrapper({ panel, tableView, dashboard }: PanelEditPanelWrapperProps) {
  const styles = useStyles2(getStyles);
  const soloPanelContext = useMemo(() => new SoloPanelContextForPanelEdit(panel), [panel]);

  return (
    <div className={styles.container}>
      <SandboxConsentBanner
        dashboardUid={dashboard.state.uid}
        panelId={panel.getLegacyPanelId()}
        className={styles.banner}
      />
      <div className={styles.panel}>
        {tableView ? (
          <tableView.Component model={tableView} />
        ) : (
          <SoloPanelContextProvider value={soloPanelContext} singleMatch={true} dashboard={dashboard}>
            <dashboard.state.body.Component model={dashboard.state.body} />
          </SoloPanelContextProvider>
        )}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The classic editor's splitter pane is a flex row, so the wrapper must grow or the panel measures 0 wide.
  container: css({
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    minWidth: 0,
    gap: theme.spacing(1),
    height: '100%',
  }),
  // The banner's default margin is for the dashboard page; here it lines up with the panel.
  banner: css({
    margin: 0,
  }),
  panel: css({
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: 0,
  }),
});
