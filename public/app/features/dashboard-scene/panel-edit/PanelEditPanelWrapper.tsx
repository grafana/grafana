import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { type VizPanel, useSceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';
import { SoloPanelContextProvider, useDefineSoloPanelContext } from '../scene/SoloPanelContext';

interface PanelEditPanelWrapperProps {
  panel: VizPanel;
  tableView?: VizPanel;
  dashboard: DashboardScene;
}

export function PanelEditPanelWrapper({ panel, tableView, dashboard }: PanelEditPanelWrapperProps) {
  const styles = useStyles2(getStyles);
  const soloPanelContext = useDefineSoloPanelContext(panel.getPathId());

  // This is to make sure the panel always remains active even when tableView is
  // rendered as the queries tab and other things subscribe / update panel state
  useSceneObjectState(panel, { shouldActivateOrKeepAlive: true });

  if (tableView) {
    return (
      <div className={styles.vizWrapper}>
        <tableView.Component model={tableView} />
      </div>
    );
  }

  return (
    <div className={styles.vizWrapper}>
      <SoloPanelContextProvider value={soloPanelContext!} singleMatch={true} dashboard={dashboard}>
        <dashboard.state.body.Component model={dashboard.state.body} />
      </SoloPanelContextProvider>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    vizWrapper: css({
      height: '100%',
      width: '100%',
      paddingLeft: theme.spacing(2),
    }),
  };
}
