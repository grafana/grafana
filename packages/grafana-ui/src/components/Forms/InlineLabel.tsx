import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { PopoverContent } from '../Tooltip/types';

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

export const InlineLabel = ({
  children,
  className,
  tooltip,
  width,
  transparent,
  interactive,
  as: Component = 'label',
  ...rest
}: Props) => {
  const styles = useStyles2(getInlineLabelStyles, transparent, width);

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
    label: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      padding: theme.spacing(0, 1),
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.size.sm,
      backgroundColor: transparent ? 'transparent' : theme.colors.background.secondary,
      height: theme.spacing(theme.components.height.md),
      lineHeight: theme.spacing(theme.components.height.md),
      marginRight: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      border: 'none',
      width: width ? (width !== 'auto' ? `${8 * width}px` : width) : '100%',
      color: theme.colors.text.primary,
    }),
    icon: css({
      color: theme.colors.text.secondary,
      marginLeft: '10px',

      ':hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
};
