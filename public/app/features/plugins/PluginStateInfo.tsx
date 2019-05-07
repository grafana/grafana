import React, { FC, useContext } from 'react';
import { css } from 'emotion';
import { PluginState, Tooltip, ThemeContext } from '@grafana/ui';
import { PopperContent } from '@grafana/ui/src/components/Tooltip/PopperController';

interface Props {
  state?: PluginState;
}

function getPluginStateInfoText(state?: PluginState): PopperContent<any> | null {
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
  if (!text) {
    return null;
  }

  const theme = useContext(ThemeContext);

  const styles = css`
    background: linear-gradient(to bottom, ${theme.colors.blueBase}, ${theme.colors.blueShade});
    color: ${theme.colors.gray7};
    white-space: nowrap;
    border-radius: 3px;
    text-shadow: none;
    font-size: 13px;
    padding: 4px 8px;
    margin-left: 16px;
    cursor: help;
  `;

  return (
    <Tooltip content={text} theme={'info'} placement={'top'}>
      <div className={styles}>
        <i className="fa fa-warning" /> {props.state}
      </div>
    </Tooltip>
  );
};

export default PluginStateinfo;
