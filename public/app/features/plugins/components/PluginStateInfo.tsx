import React from 'react';

import { PluginState } from '@grafana/data';
import { Badge, BadgeProps } from '@grafana/ui';

interface Props {
  state?: PluginState;
}

export const PluginStateInfo = (props: Props) => {
  const display = getFeatureStateInfo(props.state);

  if (!display) {
    return null;
  }

  return <Badge color={display.color} title={display.tooltip} text={display.text} icon={display.icon} />;
};

function getFeatureStateInfo(state?: PluginState): BadgeProps | null {
  switch (state) {
    case PluginState.deprecated:
      return {
        text: 'Deprecated',
        color: 'red',
        tooltip: `This feature is deprecated and will be removed in a future release`,
      };
    case PluginState.alpha:
      return {
        text: 'Alpha',
        color: 'blue',
        tooltip: `This feature is experimental and future updates might not be backward compatible`,
      };
    case PluginState.beta:
      return {
        text: 'Beta',
        color: 'blue',
        tooltip: `This feature is close to complete but not fully tested`,
      };
    default:
      return null;
  }
}
