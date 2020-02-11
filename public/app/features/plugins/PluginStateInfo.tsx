import React, { FC } from 'react';
import { AlphaNotice } from '@grafana/ui';
import { PluginState } from '@grafana/data';
import { css } from 'emotion';

interface Props {
  state?: PluginState;
}

function getPluginStateInfoText(state?: PluginState): string | null {
  switch (state) {
    case PluginState.alpha:
      return 'Alpha Plugin: This plugin is a work in progress and updates may include breaking changes';
    case PluginState.beta:
      return 'Beta Plugin: There could be bugs and minor breaking changes to this plugin';
  }
  return null;
}

const PluginStateinfo: FC<Props> = props => {
  const text = getPluginStateInfoText(props.state);

  if (!text) {
    return null;
  }

  return (
    <AlphaNotice
      state={props.state}
      text={text}
      className={css`
        margin-left: 16px;
      `}
    />
  );
};

export default PluginStateinfo;
