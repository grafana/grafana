import React, { FC, useContext } from 'react';
import { css, cx } from 'emotion';
import { PluginState, ThemeContext } from '../../index';
import { Tooltip } from '../index';

interface Props {
  state?: PluginState;
  text?: JSX.Element;
  className?: string;
}

export const AlphaNotice: FC<Props> = ({ state, text, className }) => {
  const tooltipContent = text || (
    <div>
      <h5>Alpha Feature</h5>
      <p>This feature is a work in progress and updates may include breaking changes.</p>
    </div>
  );

  const theme = useContext(ThemeContext);

  const styles = cx(
    className,
    css`
      background: linear-gradient(to bottom, ${theme.colors.blueBase}, ${theme.colors.blueShade});
      color: ${theme.colors.gray7};
      white-space: nowrap;
      border-radius: 3px;
      text-shadow: none;
      font-size: 13px;
      padding: 4px 8px;
      cursor: help;
      display: inline-block;
    `
  );

  return (
    <Tooltip content={tooltipContent} theme={'info'} placement={'top'}>
      <div className={styles}>
        <i className="fa fa-warning" /> {state}
      </div>
    </Tooltip>
  );
};
