import { css, cx } from '@emotion/css';
import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Input, TextArea, useStyles2 } from '@grafana/ui';

import { Correlation } from '../types';

import { QueryEditorField } from './QueryEditorField';
import { FormDTO } from './types';

const getInputId = (inputName: string, correlation?: CorrelationBaseData) => {
  if (!correlation) {
    return inputName;
  }

  return `${inputName}_${correlation.sourceUID}-${correlation.uid}`;
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    max-width: ${theme.spacing(32)};
  `,
  description: css`
    max-width: ${theme.spacing(80)};
  `,
});

type CorrelationBaseData = Pick<Correlation, 'uid' | 'sourceUID' | 'targetUID'>;
interface Props {
  readOnly?: boolean;
  correlation?: CorrelationBaseData;
}

export function CorrelationDetailsFormPart({ readOnly = false, correlation }: Props) {
  const styles = useStyles2(getStyles);
  const {
    register,
    formState: { errors },
  } = useFormContext<FormDTO>();
  const targetUID: string | undefined = useWatch({ name: 'targetUID' }) || correlation?.targetUID;

  return (
    <>
      <input type="hidden" {...register('config.type')} />

      <Field label="Label" className={styles.label}>
        <Input
          id={getInputId('label', correlation)}
          {...register('label')}
          readOnly={readOnly}
          placeholder="i.e. Tempo traces"
        />
      </Field>

      <Field
        label="Description"
        // the Field component automatically adds margin to itself, so we are forced to workaround it by overriding  its styles
        className={cx(styles.description)}
      >
        <TextArea id={getInputId('description', correlation)} {...register('description')} readOnly={readOnly} />
      </Field>

      <Field
        label="Target field"
        className={styles.label}
        invalid={!!errors?.config?.field}
        error={errors?.config?.field?.message}
      >
        <Input
          id={getInputId('field', correlation)}
          {...register('config.field', { required: 'This field is required.' })}
          readOnly={readOnly}
        />
      </Field>

      <QueryEditorField
        name="config.target"
        dsUid={targetUID}
        invalid={!!errors?.config?.target}
        // @ts-expect-error react-hook-form's errors do not work well with object types
        error={errors?.config?.target?.message}
      />
    </>
  );
}
