import { css, cx } from '@emotion/css';
import React from 'react';
import { RegisterOptions, UseFormRegisterReturn } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Input, TextArea, useStyles2 } from '@grafana/ui';

import { EditFormDTO } from './types';

const getInputId = (inputName: string, correlation?: EditFormDTO) => {
  if (!correlation) {
    return inputName;
  }

  return `${inputName}_${correlation.sourceUID}-${correlation.uid}`;
};

const getStyles = (theme: GrafanaTheme2) => ({
  marginless: css`
    margin: 0;
  `,
  label: css`
    max-width: ${theme.spacing(32)};
  `,
  description: css`
    max-width: ${theme.spacing(80)};
  `,
});

interface Props {
  register: (path: 'label' | 'description', options?: RegisterOptions) => UseFormRegisterReturn;
  readOnly?: boolean;
  correlation?: EditFormDTO;
}

export function CorrelationDetailsFormPart({ register, readOnly = false, correlation }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <>
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
        className={cx(readOnly && styles.marginless, styles.description)}
      >
        <TextArea id={getInputId('description', correlation)} {...register('description')} readOnly={readOnly} />
      </Field>
    </>
  );
}
