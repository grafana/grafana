import { cx } from '@emotion/css';
import { compose } from '@percona/platform-core/dist/shared/validators';
import React, { FC, useMemo } from 'react';
import { Field } from 'react-final-form';

import { Icon, Tooltip, Switch, useStyles } from '@grafana/ui';

import { getStyles } from './Switch.styles';
import { SwitchFieldRenderProps, SwitchFieldProps } from './Switch.types';

export const SwitchField: FC<SwitchFieldProps> = ({
  disabled,
  fieldClassName,
  inputProps,
  label,
  name,
  validators,
  tooltip,
  tooltipIcon = 'info-circle',
  ...fieldConfig
}) => {
  const styles = useStyles(getStyles);
  const inputId = `input-${name}-id`;
  const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);

  return (
    <Field<boolean> {...fieldConfig} type="checkbox" name={name} validate={validate}>
      {({ input, meta }: SwitchFieldRenderProps) => (
        <div className={cx(styles.field, fieldClassName)} data-testid={`${name}-field-container`}>
          <div className={styles.fieldWithLabelWrapper}>
            <Switch {...input} value={input.checked} disabled={disabled} data-testid={`${name}-switch`} />
            {label && (
              <div className={styles.labelWrapper}>
                <label className={styles.label} htmlFor={inputId} data-testid={`${name}-field-label`}>
                  {label}
                </label>
                {tooltip && (
                  <Tooltip content={<span>{tooltip}</span>} data-testid={`${name}-field-tooltip`}>
                    <Icon name={tooltipIcon} />
                  </Tooltip>
                )}
              </div>
            )}
          </div>
          <div data-testid={`${name}-field-error-message`} className={styles.errorMessage}>
            {meta.touched && meta.error}
          </div>
        </div>
      )}
    </Field>
  );
};
