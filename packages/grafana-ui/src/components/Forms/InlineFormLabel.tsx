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
  /** @depecated */
  isFocused?: boolean;
  /** @depecated */
  isInvalid?: boolean;
  /** Content for the labels tooltip. If provided, an info icon with the tooltip content
   * will be displayed */
  tooltip?: PopoverContent;
  /** Custom width for the label */
  width?: number | 'auto';
  /** A toggle to apply query keyword styling to the label */
  queryKeyword?: boolean;
}

export const InlineFormLabel: FunctionComponent<Props> = ({
  children,
  className,
  htmlFor,
  tooltip,
  width,
  queryKeyword,
  ...rest
}) => {
  const theme = useTheme();
  const styles = getStyles(theme, width, queryKeyword);

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

const getStyles = (theme: GrafanaTheme, width?: number | 'auto', queryKeyword = false) => {
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
      color: ${queryKeyword ? theme.colors.textBlue : 'inherit'};
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
