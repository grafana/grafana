import React, { FunctionComponent, HTMLProps, ReactNode } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { Tooltip, PopoverContent } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
import { useTheme } from '../../themes';

export interface Props extends Omit<HTMLProps<HTMLLabelElement>, 'children' | 'className'> {
  children: ReactNode;
  className?: string;
  isFocused?: boolean;
  isInvalid?: boolean;
  tooltip?: PopoverContent;
  width?: number | 'auto';
}

export const FormLabel: FunctionComponent<Props> = ({
  children,
  isFocused,
  isInvalid,
  className,
  htmlFor,
  tooltip,
  width,
  ...rest
}) => {
  const theme = useTheme();
  const styles = getStyles(theme, width);

  return (
    <label className={styles.label} {...rest}>
      {children}
      {tooltip && (
        <Tooltip placement="top" content={tooltip} theme="info">
          <Icon name="info-circle" size="sm" className={styles.icon} />
        </Tooltip>
      )}
    </label>
  );
};

const getStyles = (theme: GrafanaTheme, width?: number | 'auto') => {
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

export const InlineFormLabel = FormLabel;
