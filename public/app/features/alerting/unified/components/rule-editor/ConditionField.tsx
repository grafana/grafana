import { css } from '@emotion/css';
import { last } from 'lodash';
import React, { FC, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Alert, Card, Field, InputControl, RadioButtonList, useStyles2 } from '@grafana/ui';
import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';

import { RuleFormValues } from '../../types/rule-form';

interface Props {
  existing?: boolean;
}

export const ConditionField: FC<Props> = ({ existing = false }) => {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const queries = watch('queries');
  const condition = watch('condition');

  const expressions = useMemo(() => {
    return queries.filter((query) => query.datasourceUid === ExpressionDatasourceUID);
  }, [queries]);

  const options = useMemo(
    () =>
      queries
        .filter((q) => !!q.refId)
        .map<SelectableValue<string>>((q) => ({
          value: q.refId,
          label: `${q.refId} - ${expressions.includes(q) ? 'expression' : 'query'}`,
        })),
    [queries, expressions]
  );

  // automatically use the last expression when new expressions have been added
  useEffect(() => {
    const lastExpression = last(expressions);
    if (lastExpression && !existing) {
      setValue('condition', lastExpression.refId, { shouldValidate: true });
    }
  }, [expressions, setValue, existing]);

  // reset condition if option no longer exists or if it is unset, but there are options available
  useEffect(() => {
    const lastExpression = last(expressions);
    const conditionExists = options.find(({ value }) => value === condition);

    if (condition && !conditionExists) {
      setValue('condition', lastExpression?.refId ?? null);
    } else if (!condition && lastExpression) {
      setValue('condition', lastExpression.refId, { shouldValidate: true });
    }
  }, [condition, expressions, options, setValue]);

  const styles = useStyles2(getStyles);

  return options.length ? (
    <Card className={styles.container}>
      <Card.Heading>Set alert condition</Card.Heading>
      <Card.Meta>Select one of your queries or expressions set above that contains your alert condition.</Card.Meta>
      <Card.Actions>
        <Field error={errors.condition?.message} invalid={!!errors.condition?.message}>
          <InputControl
            name="condition"
            render={({ field: { onChange, ref, ...field } }) => (
              <RadioButtonList options={options} onChange={onChange} {...field} />
            )}
            rules={{
              required: {
                value: true,
                message: 'Please select the condition to alert on',
              },
            }}
          />
        </Field>
      </Card.Actions>
    </Card>
  ) : (
    <Alert title="No queries or expressions have been configured" severity="warning" className={styles.container}>
      Create at least one query or expression to be alerted on
    </Alert>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    max-width: ${theme.breakpoints.values.sm}px;
  `,
});
