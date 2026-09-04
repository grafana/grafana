import { type PluginState } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { InlineLabel, Stack } from '@grafana/ui';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';

export type Props = {
  state?: PluginState;
};

export function DataSourcePluginState({ state }: Props) {
  return (
    <Stack alignItems="center" gap={0.5}>
      <InlineLabel width={20}>
        <Trans i18nKey="datasources.data-source-plugin-state.plugin-state">Plugin state</Trans>
      </InlineLabel>
      <PluginStateInfo state={state} />
    </Stack>
  );
}
