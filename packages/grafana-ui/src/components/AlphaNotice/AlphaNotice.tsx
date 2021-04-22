import React, { FC, useContext } from 'react';
import { css, cx } from '@emotion/css';
import { ThemeContext } from '../../index';
import { PluginState } from '@grafana/data';
import { Icon } from '../Icon/Icon';

export interface Props {
  state?: PluginState;
  text?: string;
  className?: string;
}

export const AlphaNotice: FC<Props> = ({ state, text, className }) => {
  const tooltipContent = text || 'This feature is a work in progress and updates may include breaking changes';
  const theme = useContext(ThemeContext);

  const styles = cx(
    className,
    css`
      background: ${theme.colors.primary.transparent};
      color: ${theme.colors.text.secondary};
      white-space: nowrap;
      border-radius: 3px;
      text-shadow: none;
      font-size: ${theme.typography.size.sm};
      padding: 0 8px;
      cursor: help;
      display: inline-block;
    `
  );

  return (
    <div className={styles} title={tooltipContent}>
      <Icon name="exclamation-triangle" /> {state}
    </div>
  );
};
