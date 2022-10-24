import { css } from '@emotion/css';
import React, { ComponentProps } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../themes';
import { ReactUtils } from '../../utils';
import { Field } from '../Forms/Field';
import { Icon } from '../Icon/Icon';
import { PopoverContent, Tooltip } from '../Tooltip';

import { Space } from './Space';

interface EditorFieldProps extends ComponentProps<typeof Field> {
  label: string;
  children: React.ReactElement;
  width?: number | string;
  optional?: boolean;
  tooltip?: PopoverContent;
  tooltipInteractive?: boolean;
}

export const EditorField: React.FC<EditorFieldProps> = (props) => {
  const { label, optional, tooltip, tooltipInteractive, children, width, ...fieldProps } = props;

  const theme = useTheme2();
  const styles = getStyles(theme, width);

  // Null check for backward compatibility
  const childInputId = fieldProps?.htmlFor || ReactUtils?.getChildId(children);

  const labelEl = (
    <>
      <label className={styles.label} htmlFor={childInputId}>
        {label}
        {optional && <span className={styles.optional}> - optional</span>}
        {tooltip && (
          <Tooltip placement="top" content={tooltip} theme="info" interactive={tooltipInteractive}>
            <Icon name="info-circle" size="sm" className={styles.icon} />
          </Tooltip>
        )}
      </label>
      <Space v={0.5} />
    </>
  );

  return (
    <div className={styles.root}>
      <Field className={styles.field} label={labelEl} {...fieldProps}>
        {children}
      </Field>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2, width?: number | string) => {
  return {
    root: css({
      minWidth: theme.spacing(width ?? 0),
    }),
    label: css({
      fontSize: 12,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    optional: css({
      fontStyle: 'italic',
      color: theme.colors.text.secondary,
    }),
    field: css({
      marginBottom: 0, // GrafanaUI/Field has a bottom margin which we must remove
    }),
    icon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
      ':hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
});
