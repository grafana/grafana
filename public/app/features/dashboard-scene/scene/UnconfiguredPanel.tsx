import { PanelPlugin, PanelProps } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { sceneUtils } from '@grafana/scenes';
import { Box, Button, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export const UNCONFIGURED_PANEL_PLUGIN_ID = '__unconfigured-panel';
const UnconfiguredPanel = new PanelPlugin(UnconfiguredPanelComp);

function UnconfiguredPanelComp(props: PanelProps) {
  const onConfigure = () => {
    locationService.partial({ editPanel: props.id });
  };

  return (
    <Stack direction={'row'} alignItems={'center'} height={'100%'} justifyContent={'center'}>
      <Box paddingBottom={2}>
        <Button icon="sliders-v-alt" onClick={onConfigure}>
          <Trans i18nKey="dashboard.new-panel.configure-button">Configure panel</Trans>
        </Button>
      </Box>
    </Stack>
  );
}

sceneUtils.registerRuntimePanelPlugin({
  pluginId: UNCONFIGURED_PANEL_PLUGIN_ID,
  plugin: UnconfiguredPanel,
});
