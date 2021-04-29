import React, { FC, Fragment } from 'react';
import { Button, Field, Input, InlineLabel, Label, useStyles, Checkbox } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { SilenceFormFields } from '../../types/silence-form';
import { AlertLabels } from '../AlertLabels';

interface Props {
  className?: string;
}

const MatchersField: FC<Props> = ({ className }) => {
  const styles = useStyles(getStyles);
  const formApi = useFormContext<SilenceFormFields>();
  const { register, getValues, setValue } = formApi;
  const { fields: matchers = [], append, remove } = useFieldArray<SilenceFormFields>({ name: 'matchers' });

  const addMatcher = () => {
    const { matcherName, matcherValue, isRegex } = getValues();
    append({ name: matcherName, value: matcherValue, isRegex });
    setValue('matcherName', '');
    setValue('matcherValue', '');
    setValue('isRegex', false);
  };

  const onRemoveLabel = (index: number) => {
    remove(index);
  };
  return (
    <div className={cx(className, styles.wrapper)}>
      <Label>Matchers</Label>
      <AlertLabels matchers={matchers} onRemoveLabel={onRemoveLabel} />
      {/* Hide the fields from the form but they need to be registered in order to be in the form state */}
      <div className={styles.displayNone}>
        {matchers.map((matcher, index) => {
          return (
            <Fragment key={`${matcher.name}-${matcher.value}-${index}`}>
              <Input {...register(`matchers.${index}.name` as const)} defaultValue={matcher.name} />
              <Input {...register(`matchers.${index}.value` as const)} defaultValue={matcher.value} />
              <Checkbox {...register(`matchers.${index}.isRegex` as const)} defaultChecked={matcher.isRegex} />
            </Fragment>
          );
        })}
      </div>

      <div className={cx(styles.flexRow)}>
        <Field className={styles.labelInput} label="Name">
          <Input {...register('matcherName')} placeholder="name" />
        </Field>
        <InlineLabel className={styles.equalSign}>=</InlineLabel>
        <Field className={styles.labelInput} label="Value">
          <Input {...register('matcherValue')} placeholder="value" />
        </Field>
        <Field label="Regex" className={styles.regexCheckbox}>
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
    flexRow: css`
      display: flex;
      flex-direction: row;
      align-items: flex-end;
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
  };
};

export default MatchersField;
