import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useAsync } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { LoadingPlaceholder, Text, useStyles2 } from '@grafana/ui';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { isDashboardV2Resource } from 'app/features/dashboard/api/utils';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { findVizPanelByKey, getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/utils';

import { HomeSection } from '../../HomeSection';

interface BuiltPanel {
  scene: DashboardScene;
  panel: VizPanel;
}

async function buildPinnedPanel(dashboardUid: string, panelId: number): Promise<BuiltPanel> {
  const api = await getDashboardAPI(); // unified — auto-selects the enabled v1/v2 API
  const dto = await api.getDashboardDTO(dashboardUid); // DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>
  const scene = isDashboardV2Resource(dto) ? transformSaveModelSchemaV2ToScene(dto) : transformSaveModelToScene(dto);
  const panel = findVizPanelByKey(scene, getVizPanelKeyForPanelId(panelId));
  if (!panel) {
    throw new Error('panel-not-found');
  }
  // No dashboard kebab on a homepage widget; it would navigate off the homepage.
  panel.setState({ menu: undefined });
  return { scene, panel };
}

interface PanelWidgetProps {
  dashboardUid: string;
  panelId: number;
}

export function PanelWidget({ dashboardUid, panelId }: PanelWidgetProps) {
  const styles = useStyles2(getStyles);
  const { value, loading, error } = useAsync(() => buildPinnedPanel(dashboardUid, panelId), [dashboardUid, panelId]);

  // Activate the scene so its $timeRange + the panel's query runner come alive; deactivate on unmount.
  useEffect(() => {
    if (!value) {
      return;
    }
    return value.scene.activate();
  }, [value]);

  return (
    <HomeSection display="flex" height="100%">
      <div className={styles.wrap}>
        {loading && <LoadingPlaceholder text={t('home.widgets.panel.loading', 'Loading panel…')} />}
        {error && (
          <Text color="secondary">{t('home.widgets.panel.unavailable', 'This panel is no longer available.')}</Text>
        )}
        {value && <value.panel.Component model={value.panel} />}
      </div>
    </HomeSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The grid cell sets the outer height; the panel fills it.
  wrap: css({ height: '100%', minHeight: theme.spacing(25), width: '100%' }),
});
