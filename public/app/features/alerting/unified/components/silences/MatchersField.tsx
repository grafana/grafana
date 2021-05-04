import React, { FC, Fragment, useCallback } from 'react';
import { Button, Field, Input, InlineLabel, useStyles, Checkbox } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { SilenceFormFields } from '../../types/silence-form';
import { Matchers } from './Matchers';

interface Props {
  className?: string;
}

const MatchersField: FC<Props> = ({ className }) => {
  const styles = useStyles(getStyles);
  const formApi = useFormContext<SilenceFormFields>();
  const { register, getValues, setValue, control, setError, clearErrors, formState } = formApi;
  const { fields: matchers = [], append, remove } = useFieldArray<SilenceFormFields>({ name: 'matchers' });

  const addMatcher = () => {
    const { matcherName, matcherValue, isRegex } = getValues();
    const matcherAlreadyExists = matchers.some(
      (matcher) => matcherName === matcher.name && matcherValue === matcher.value && isRegex === matcher.isRegex
    );

    if (matcherAlreadyExists) {
      setError('matcherName', { message: 'Matcher already exists' });
    } else if (!matcherName || !matcherValue) {
      setError('matcherName', { message: 'Matcher must have name and value' });
    } else {
      append({ name: matcherName, value: matcherValue, isRegex });
      setValue('matcherName', '');
      setValue('matcherValue', '');
      setValue('isRegex', false);
    }
  };

  const onRemoveLabel = (index: number) => {
    remove(index);
  };

  const clearErrorsOnFocus = useCallback(() => {
    if (formState.errors.matcherName) {
      clearErrors('matcherName');
    }
  }, [formState.errors.matcherName, clearErrors]);

  return (
    <div className={cx(className, styles.wrapper)}>
      <Field
        label="Matchers"
        required
        invalid={!!formState.errors.matcherName}
        error={formState.errors.matcherName?.message}
      >
        <div>
          <div className={styles.matchers}>
            <Matchers matchers={matchers} onRemoveLabel={onRemoveLabel} />
          </div>
          {matchers.map((matcher, index) => {
            return (
              <Fragment key={`${matcher.id}`}>
                <Controller
                  name={`matchers.${index}.name` as const}
                  defaultValue={matcher.name}
                  control={control}
                  render={() => <></>}
                />
                <Controller
                  name={`matchers.${index}.value` as const}
                  defaultValue={matcher.value}
                  control={control}
                  render={() => <></>}
                />
                <Controller
                  name={`matchers.${index}.isRegex` as const}
                  defaultValue={matcher.isRegex}
                  control={control}
                  render={() => <></>}
                />
              </Fragment>
            );
          })}
        </div>
      </Field>

      <div className={cx(styles.row)}>
        <Field className={styles.labelInput} label="Name">
          <Input {...register('matcherName')} placeholder="name" onFocus={clearErrorsOnFocus} />
        </Field>
        <InlineLabel className={styles.equalSign}>=</InlineLabel>
        <Field className={styles.labelInput} label="Value">
          <Input {...register('matcherValue')} placeholder="value" onFocus={clearErrorsOnFocus} />
        </Field>
        <Field label="Regex" className={styles.regexCheckbox} onFocus={clearErrorsOnFocus}>
          <Checkbox {...register('isRegex')} />
        </Field>
      </div>
      <Button type="button" icon="plus" variant="secondary" onClick={addMatcher}>
        Add matcher
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      margin-top: ${theme.spacing.md};
    `,
    flexColumn: css`
      display: flex;
      flex-direction: column;
    `,
    row: css`
      display: flex;
      flex-direction: row;
      align-items: flex-end;
      background-color: ${theme.colors.bg2};
      max-width: 585px;
      padding: ${theme.spacing.md};
      margin-bottom: ${theme.spacing.md};
    `,
    equalSign: css`
      width: 28px;
      justify-content: center;
      margin-left: ${theme.spacing.xs};
      margin-bottom: ${theme.spacing.sm};
    `,
    regexCheckbox: css`
      padding: 0 ${theme.spacing.sm};
      width: 44px;
      margin-bottom: ${theme.spacing.sm};
    `,
    labelInput: css`
      width: 207px;
      margin-bottom: ${theme.spacing.sm};
    `,
    displayNone: css`
      display: none;
    `,
    matchers: css`
      min-height: ${theme.spacing.lg};
      margin: ${theme.spacing.md} 0;
    `,
  };
};

export default MatchersField;
