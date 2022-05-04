import { css, cx } from '@emotion/css';
import React, { FunctionComponent } from 'react';

import { GrafanaTheme } from '@grafana/data';

import { useTheme } from '../../themes';
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
  /** @deprecated */
  /** This prop is deprecated and is not used anymore */
  isFocused?: boolean;
  /** @deprecated */
  /** This prop is deprecated and is not used anymore */
  isInvalid?: boolean;
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
  const theme = useTheme();
  const styles = getInlineLabelStyles(theme, transparent, width);
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

export const getInlineLabelStyles = (theme: GrafanaTheme, transparent = false, width?: number | 'auto') => {
  return {
    label: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      padding: 0 ${theme.spacing.sm};
      font-weight: ${theme.typography.weight.semibold};
      font-size: ${theme.typography.size.sm};
      background-color: ${transparent ? 'transparent' : theme.colors.bg2};
      height: ${theme.height.md}px;
      line-height: ${theme.height.md}px;
      margin-right: ${theme.spacing.xs};
      border-radius: ${theme.border.radius.md};
      border: none;
      width: ${width ? (width !== 'auto' ? `${8 * width}px` : width) : '100%'};
      color: ${theme.colors.textHeading};
    `,
    icon: css`
      color: ${theme.colors.textWeak};
      margin-left: 10px;

      :hover {
        color: ${theme.colors.text};
      }
    `,
  };
};
