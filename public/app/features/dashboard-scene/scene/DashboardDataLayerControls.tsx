import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { isDashboardDataLayerSet, isDashboardDataLayerSetState } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';
import { DataLayerControl } from './DataLayerControl';

export function DashboardDataLayerControls({ dashboard }: { dashboard: DashboardScene }) {
  // We render controls here (instead of the data layer set's default renderer) to
  // respect per-layer `placement` and edit-mode visibility rules.
  const dataLayerSet = sceneGraph.getData(dashboard);
  const state = dataLayerSet.useState();
  const styles = useStyles2(getStyles);

  const visibleLayers = useMemo(() => {
    if (!isDashboardDataLayerSetState(state) || !isDashboardDataLayerSet(dataLayerSet)) {
      return [];
    }
    return state.annotationLayers.filter((layer) => !layer.state.isHidden && layer.state.placement === undefined);
  }, [state, dataLayerSet]);

  return useMemo(
    () =>
      visibleLayers.map((layer) => (
        <div key={layer.state.key} className={styles.container}>
          <DataLayerControl layer={layer} />
        </div>
      )),
    [visibleLayers, styles.container]
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    label: 'dashboard-data-layer-controls',
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
});
