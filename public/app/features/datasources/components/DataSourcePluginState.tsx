import { PluginState } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';

export type Props = {
  state?: PluginState;
};

export function DataSourcePluginState({ state }: Props) {
  return (
    <div className="gf-form">
      <div className="gf-form-label width-10">
        <Trans i18nKey="datasources.data-source-plugin-state.plugin-state">Plugin state</Trans>
      </div>
      <div className="gf-form-label gf-form-label--transparent">
        <PluginStateInfo state={state} />
      </div>
    </div>
  );
}
