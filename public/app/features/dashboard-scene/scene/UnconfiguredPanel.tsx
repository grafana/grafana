import { useCallback, useState } from 'react';

import { PanelPlugin, PanelProps } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { sceneUtils } from '@grafana/scenes';
import { Box, Button, ButtonGroup, Dropdown, Menu, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { findVizPanelByKey, getVizPanelKeyForPanelId } from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { DashboardGridItem } from './layout-default/DashboardGridItem';

export const UNCONFIGURED_PANEL_PLUGIN_ID = '__unconfigured-panel';
const UnconfiguredPanel = new PanelPlugin(UnconfiguredPanelComp);

function UnconfiguredPanelComp(props: PanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dashboard = window.__grafanaSceneContext;

  if (!(dashboard instanceof DashboardScene)) {
    throw new Error('DashboardScene not found');
  }

  const panel = findVizPanelByKey(dashboard, getVizPanelKeyForPanelId(props.id));
  if (!panel) {
    throw new Error('Panel not found');
  }

  const onMenuClick = useCallback((isOpen: boolean) => {
    setIsOpen(isOpen);
  }, []);

  const onConfigure = () => {
    locationService.partial({ editPanel: props.id });
  };

  const onUseLibraryPanel = () => {
    dashboard.onShowAddLibraryPanelDrawer(panel.getRef());
  };

  const isInsideCustomGrid = panel.parent instanceof DashboardGridItem;

  const MenuActions = () => (
    <Menu>
      <Menu.Item
        icon="pen"
        label={t('dashboard.new-panel.menu-open-panel-editor', 'Configure')}
        onClick={onConfigure}
      ></Menu.Item>
      <Menu.Item
        icon="library-panel"
        label={t('dashboard.new-panel.menu-use-library-panel', 'Use library panel')}
        onClick={onUseLibraryPanel}
      ></Menu.Item>
    </Menu>
  );

  return (
    <Stack direction={'row'} alignItems={'center'} height={'100%'} justifyContent={'center'}>
      <Box paddingBottom={2}>
        {/* Temporary restrict library panel usage to only panels inside custom grid */}
        {isInsideCustomGrid ? (
          <ButtonGroup>
            <Button icon="sliders-v-alt" onClick={onConfigure}>
              <Trans i18nKey="dashboard.new-panel.configure-button">Configure</Trans>
            </Button>
            <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={onMenuClick}>
              <Button
                aria-label="dashboard.new-panel.configure-button-menu"
                icon={isOpen ? 'angle-up' : 'angle-down'}
              />
            </Dropdown>
          </ButtonGroup>
        ) : (
          <Button icon="sliders-v-alt" onClick={onConfigure}>
            <Trans i18nKey="dashboard.new-panel.configure-button">Configure</Trans>
          </Button>
        )}
      </Box>
    </Stack>
  );
}

sceneUtils.registerRuntimePanelPlugin({
  pluginId: UNCONFIGURED_PANEL_PLUGIN_ID,
  plugin: UnconfiguredPanel,
});
