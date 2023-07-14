import React from 'react';

import { PluginState } from '@grafana/data';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';

export type Props = {
  state?: PluginState;
};

export function DataSourcePluginState({ state }: Props) {
  return (
    <div className="gf-form">
      <div className="gf-form-label width-10">Plugin state</div>
      <div className="gf-form-label gf-form-label--transparent">
        <PluginStateInfo state={state} />
      </div>
    </div>
  );
}
