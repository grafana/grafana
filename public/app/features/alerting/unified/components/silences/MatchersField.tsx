import React, { FC, Fragment } from 'react';
import { Button, Field, Input, InlineLabel, Label, useStyles, Checkbox } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useFormContext } from 'react-hook-form';
import { SilenceFormFields } from '../../types/silence-form';
import { useControlledFieldArray } from '../../hooks/useControlledFieldArray';
import { AlertLabels } from '../AlertLabels';
import { SilenceMatcher } from 'app/plugins/datasource/alertmanager/types';

interface Props {
  className?: string;
}

const MatchersField: FC<Props> = ({ className }) => {
  const styles = useStyles(getStyles);
  const formApi = useFormContext<SilenceFormFields>();
  const { register, getValues, setValue } = formApi;
  const { items: matchers = [], append, remove } = useControlledFieldArray<SilenceMatcher>('matchers', formApi);

  const addMatcher = () => {
    const { matcherName, matcherValue, isRegex } = getValues();
    append({ name: matcherName, value: matcherValue, isRegex });
    setValue([{ matcherName: '' }, { matcherValue: '' }, { isRegex: false }]);
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
              <Input ref={register()} name={`matchers[${index}].name`} defaultValue={matcher.name} />
              <Input ref={register()} name={`matchers[${index}].value`} defaultValue={matcher.value} />
              <Checkbox ref={register()} name={`matchers[${index}].isRegex`} defaultChecked={matcher.isRegex} />
            </Fragment>
          );
        })}
      </div>

      <div className={cx(styles.flexRow)}>
        <Field className={styles.labelInput} label="Name">
          <Input ref={register()} name={`matcherName`} placeholder="name" />
        </Field>
        <InlineLabel className={styles.equalSign}>=</InlineLabel>
        <Field className={styles.labelInput} label="Value">
          <Input ref={register()} name={`matcherValue`} placeholder="value" />
        </Field>
        <Field label="Regex" className={styles.regexCheckbox}>
          <Checkbox ref={register()} name={`isRegex`} />
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
