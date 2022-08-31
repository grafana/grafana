import { css, cx } from '@emotion/css';
import React, { FunctionComponent, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { PopoverContent, Tooltip } from '../Tooltip';

import { LabelProps } from './Label';

export interface Props extends Omit<LabelProps, 'css' | 'description' | 'category'> {
  /** Content for the labels tooltip. If provided, an info icon with the tooltip content
   * will be displayed */
  tooltip?: PopoverContent;
  /** Custom width for the label */
  width?: number | 'auto';
  /** Make labels's background transparent */
  transparent?: boolean;
  /** Make tooltip interactive */
  interactive?: boolean;
  /** @beta */
  /** Controls which element the InlineLabel should be rendered into */
  as?: React.ElementType;
}

export const InlineLabel: FunctionComponent<Props> = ({
  children,
  className,
  tooltip,
  width,
  transparent,
  interactive,
  as: Component = 'label',
  ...rest
}) => {
  const styles = useStyles2(
    useCallback((theme) => getInlineLabelStyles(theme, transparent, width), [transparent, width])
  );

  return (
    <Component className={cx(styles.label, className)} {...rest}>
      {children}
      {tooltip && (
        <Tooltip interactive={interactive} placement="top" content={tooltip} theme="info">
          <Icon tabIndex={0} name="info-circle" size="sm" className={styles.icon} />
        </Tooltip>
      )}
    </Component>
  );
};

export const getInlineLabelStyles = (theme: GrafanaTheme2, transparent = false, width?: number | 'auto') => {
  return {
    label: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      padding: 0 ${theme.spacing(1)};
      font-weight: ${theme.typography.fontWeightMedium};
      font-size: ${theme.typography.size.sm};
      background-color: ${transparent ? 'transparent' : theme.colors.background.secondary};
      height: ${theme.spacing(theme.components.height.md)};
      line-height: ${theme.spacing(theme.components.height.md)};
      margin-right: ${theme.spacing(0.5)};
      border-radius: ${theme.shape.borderRadius(2)};
      border: none;
      width: ${width ? (width !== 'auto' ? `${8 * width}px` : width) : '100%'};
      color: ${theme.colors.text.primary};
    `,
    icon: css`
      color: ${theme.colors.text.secondary};
      margin-left: 10px;

      :hover {
        color: ${theme.colors.text.primary};
      }
    `,
  };
};
