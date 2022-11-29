import { css } from '@emotion/css';
import React, { CSSProperties, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { Dropdown } from '../Dropdown/Dropdown';
import { Icon } from '../Icon/Icon';
import { IconButton, IconButtonVariant } from '../IconButton/IconButton';
import { PopoverContent, Tooltip } from '../Tooltip';

/**
 * @internal
 */
export interface LoadingBarProps {
  width: number;
  height: number;
  ariaLabel?: string;
  barColor?: string;
}

/**
 * @internal
 */
export const LoadingBar: React.FC<LoadingBarProps> = ({
  width,
  height,
  ariaLabel = 'Loading bar',
  barColor = 'blue',
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  return <div style={{ width, height }}></div>;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {};
};
