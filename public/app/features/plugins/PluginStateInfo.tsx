import React, { FC } from 'react';
import { PluginState } from '@grafana/ui';

interface Props {
  state?: PluginState;
}

function getPluginStateInfoText(state?: PluginState): string | null {
  switch (state) {
    case PluginState.alpha:
      return (
        'This plugin is marked as being in alpha state, which means it is in early development phase and updates' +
        ' will include breaking changes.'
      );

    case PluginState.beta:
      return (
        'This plugin is marked as being in a beta development state. This means it is in currently in active' +
        ' development and could be missing important features.'
      );
  }
  return null;
}

const PluginStateinfo: FC<Props> = props => {
  const text = getPluginStateInfoText(props.state);
  if (!text) {
    return null;
  }

  return <div className="grafana-info-box">{text}</div>;
};

export default PluginStateinfo;
