import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { RadioButtonGroup } from '@grafana/ui';

import { STAT, TABLE, TIMESERIES } from '../utils/constants';

export type SupportedPanelPlugins = 'timeseries' | 'table' | 'stat';

type Props = {
  value: SupportedPanelPlugins;
  onChange: (value: SupportedPanelPlugins) => void;
  size?: 'sm' | 'md';
};

export function PanelPluginsButtonGroup(props: Props): JSX.Element | null {
  const { value, onChange, size = 'md' } = props;
  const panels = useMemo(() => getSupportedPanels(), []);

  return <RadioButtonGroup options={panels} value={value} onChange={onChange} size={size} />;
}

function getSupportedPanels(): Array<SelectableValue<SupportedPanelPlugins>> {
  return Object.values(config.panels).reduce((panels: Array<SelectableValue<SupportedPanelPlugins>>, panel) => {
    if (isSupportedPanelPlugin(panel.id)) {
      panels.push({
        value: panel.id,
        label: panel.name,
        imgUrl: panel.info.logos.small,
      });
    }
    return panels;
  }, []);
}

function isSupportedPanelPlugin(id: string): id is SupportedPanelPlugins {
  switch (id) {
    case TIMESERIES:
    case TABLE:
    case STAT:
      return true;
    default:
      return false;
  }
}
