/** @jsx jsx */
import { cx } from '@emotion/css';
import { jsx } from '@emotion/react';
import { FC, useMemo } from 'react';
import { Field } from 'react-final-form';

import { Switch, useStyles2 } from '@grafana/ui';

import { compose } from '../../../helpers/validatorsForm';
import { LabelCore } from '../LabelCore';

import { getStyles } from './Switch.styles';
import { SwitchFieldProps, SwitchFieldRenderProps } from './Switch.types';

export const SwitchField: FC<SwitchFieldProps> = ({
  disabled,
  fieldClassName,
  inputProps,
  label,
  name,
  inputId = `input-${name}-id`,
  validators,
  tooltipText = '',
  tooltipLink,
  tooltipLinkText,
  tooltipIcon,
  tooltipDataTestId,
  tooltipLinkTarget,
  ...fieldConfig
}) => {
  const styles = useStyles2(getStyles);
  const validate = useMemo(() => (Array.isArray(validators) ? compose(validators) : undefined), [validators]);

  return (
    <Field<boolean> {...fieldConfig} type="checkbox" name={name} validate={validate}>
      {({ input, meta }: SwitchFieldRenderProps) => (
        <div className={cx(styles.field, fieldClassName)} data-testid={`${name}-field-container`}>
          <LabelCore
            name={name}
            label={label}
            inputId={inputId}
            tooltipLink={tooltipLink}
            tooltipLinkText={tooltipLinkText}
            tooltipText={tooltipText}
            tooltipDataTestId={tooltipDataTestId}
            tooltipLinkTarget={tooltipLinkTarget}
            tooltipIcon={tooltipIcon}
          />
          <Switch css={{}} {...input} value={input.checked} disabled={disabled} data-testid={`${name}-switch`} />
          <div data-testid={`${name}-field-error-message`} className={styles.errorMessage}>
            {meta.touched && meta.error}
          </div>
        </div>
      )}
    </Field>
  );
};
