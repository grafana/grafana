import React from 'react';

import { CoreApp, PanelProps } from '@grafana/data';
import { FlameGraph, checkFields, getMessageCheckFieldsResult } from '@grafana/flamegraph';
import { PanelDataErrorView, reportInteraction, config } from '@grafana/runtime';

function interaction(name: string, context: Record<string, string | number> = {}) {
  reportInteraction(`grafana_flamegraph_${name}`, {
    app: CoreApp.Unknown,
    grafana_version: config.buildInfo.version,
    ...context,
  });
}

export const FlameGraphPanel = (props: PanelProps) => {
  const wrongFields = checkFields(props.data.series[0]);
  if (wrongFields) {
    return (
      <PanelDataErrorView panelId={props.id} data={props.data} message={getMessageCheckFieldsResult(wrongFields)} />
    );
  }

  return (
    <FlameGraph
      data={props.data.series[0]}
      stickyHeader={false}
      getTheme={() => config.theme2}
      showFlameGraphOnly={props.options?.showFlameGraphOnly ?? false}
      onTableSymbolClick={() => interaction('table_item_selected')}
      onViewSelected={(view: string) => interaction('view_selected', { view })}
      onTextAlignSelected={(align: string) => interaction('text_align_selected', { align })}
      onTableSort={(sort: string) => interaction('table_sort_selected', { sort })}
      disableCollapsing={!config.featureToggles.flameGraphItemCollapsing}
    />
  );
};
