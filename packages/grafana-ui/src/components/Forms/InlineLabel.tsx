import React, { FunctionComponent, HTMLProps, ReactNode } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { Tooltip, PopoverContent } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
import { useTheme } from '../../themes';

export interface Props extends Omit<HTMLProps<HTMLLabelElement>, 'children' | 'className' | 'css'> {
  /** Label content */
  children: ReactNode;
  /** Custom styles for the label */
  className?: string;
  /** Content for the labels tooltip. If provided, an info icon with the tooltip content
   * will be displayed */
  tooltip?: PopoverContent;
  /** Custom width for the label */
  width?: number | 'auto';
  /** A toggle to apply query keyword styling to the label */
  isKeyword?: boolean;
  /** @deprecated */
  /** This prop is deprecated and is not used anymore */
  isFocused?: boolean;
  /** @deprecated */
  /** This prop is deprecated and is not used anymore */
  isInvalid?: boolean;
  /** Fill the width of the container. Equivalent to setting `flex-grow:1` */
  grow?: boolean;
}

export const InlineLabel: FunctionComponent<Props> = ({
  children,
  className,
  htmlFor,
  tooltip,
  width,
  isKeyword,
  grow,
  ...rest
}) => {
  const theme = useTheme();
  const styles = getInlineLabelStyles(theme, { width, isKeyword, grow });

  return (
    <label className={cx(styles.label, className)} {...rest}>
      {children}
      {tooltip && (
        <Tooltip placement="top" content={tooltip} theme="info">
          <Icon name="info-circle" size="sm" className={styles.icon} />
        </Tooltip>
      )}
    </label>
  );
};

interface StyleOptions {
  width?: number | 'auto';
  isKeyword?: boolean;
  grow?: boolean;
}

export const getInlineLabelStyles = (theme: GrafanaTheme, options: StyleOptions) => {
  const { width, isKeyword = false, grow = false } = options;
  return {
    label: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      padding: 0 ${theme.spacing.sm};
      font-weight: ${theme.typography.weight.semibold};
      font-size: ${theme.typography.size.sm};
      background-color: ${theme.colors.bg2};
      height: ${theme.height.md}px;
      line-height: ${theme.height.md};
      margin-right: ${theme.spacing.xs};
      border-radius: ${theme.border.radius.md};
      border: none;
      // Keep the spacer at 16 px for compatibility
      width: ${width ? (width !== 'auto' ? `${16 * width}px` : width) : '100%'};
      color: ${isKeyword ? theme.colors.textBlue : 'inherit'};
      flex-grow: ${grow ? 1 : 'unset'};
    `,
    icon: css`
      flex-grow: 0;
      color: ${theme.colors.textWeak};
      margin-left: 10px;

      :hover {
        color: ${theme.colors.text};
      }
    `,
  };
};
