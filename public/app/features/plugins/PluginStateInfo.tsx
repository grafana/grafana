import React, { FC, useContext } from 'react';
import { css } from 'emotion';
import { PluginState, Tooltip, ThemeContext } from '@grafana/ui';

interface Props {
  state?: PluginState;
}

function getPluginStateInfoText(state?: PluginState): string | null {
  switch (state) {
    case PluginState.alpha:
      return 'Plugin in alpha state. Means work in progress and updates may include breaking changes.';

    case PluginState.beta:
      return 'Plugin in beta state. Means there could be bugs and minor breaking changes.';
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
  `;

  return (
    <Tooltip content={text}>
      <div className={styles}>
        <i className="fa fa-warning" /> {props.state}
      </div>
    </Tooltip>
  );
};

export default PluginStateinfo;
