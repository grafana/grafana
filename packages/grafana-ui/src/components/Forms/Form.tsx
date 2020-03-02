/**
 * This is a stub implementation only for correct styles to be applied
 */

import React, { useEffect } from 'react';
import { useForm, Mode, OnSubmit, DeepPartial, FormContextValues } from 'react-hook-form';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';

const getFormStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    form: css`
      margin-bottom: ${theme.spacing.formMargin};
    `,
  };
});

type FormAPI<T> = Pick<FormContextValues<T>, 'register' | 'errors' | 'control'>;

interface FormProps<T> {
  validateOn?: Mode;
  defaultValues?: DeepPartial<T>;
  onSubmit: OnSubmit<T>;
  children: (api: FormAPI<T>) => React.ReactNode;
}

export function Form<T>({ validateOn, defaultValues, onSubmit, children }: FormProps<T>) {
  const theme = useTheme();
  const { handleSubmit, register, errors, control, reset, getValues } = useForm<T>({
    mode: validateOn || 'onSubmit',
    defaultValues: {
      ...defaultValues,
    },
  });

  useEffect(() => {
    reset({ ...getValues(), ...defaultValues });
  }, [defaultValues]);

  const styles = getFormStyles(theme);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      {children({ register, errors, control })}
    </form>
  );
}
