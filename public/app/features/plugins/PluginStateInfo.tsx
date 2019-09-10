import React, { FC } from 'react';
import { PluginState, AlphaNotice } from '@grafana/ui';
import { css } from 'emotion';

interface Props {
  state?: PluginState;
}

function getPluginStateInfoText(state?: PluginState): JSX.Element | null {
  switch (state) {
    case PluginState.alpha:
      return (
        <div>
          <h5>Alpha Plugin</h5>
          <p>This plugin is a work in progress and updates may include breaking changes.</p>
        </div>
      );

    case PluginState.beta:
      return (
        <div>
          <h5>Beta Plugin</h5>
          <p>There could be bugs and minor breaking changes to this plugin.</p>
        </div>
      );
  }
  return null;
}

const PluginStateinfo: FC<Props> = props => {
  const text = getPluginStateInfoText(props.state);

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
