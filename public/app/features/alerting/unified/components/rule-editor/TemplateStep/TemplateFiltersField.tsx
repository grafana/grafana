 // @ts-nocheck
import React, { FC, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { Button, Field, FieldArray, Input, useStyles2, Select, Label } from '@grafana/ui';
import { AlertRuleFilterType } from 'app/percona/shared/core';

import { Messages } from './TemplateStep.messages';
import { getStyles } from './TemplateStep.styles';

const TemplateFiltersField: FC = () => {
  const styles = useStyles2(getStyles);
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext();
  const filterOptions: Array<SelectableValue<AlertRuleFilterType>> = useMemo(
    () =>
      Object.entries(AlertRuleFilterType).map(([, value]) => ({
        label: value,
        value: value,
      })),
    []
  );

  return (
    <FieldArray name="filters" control={control}>
      {({ fields, append, remove }) => (
        <>
          <div className={styles.filtersLabelWrapper}>
            <Label description={Messages.tooltips.filters}>{Messages.filter.header}</Label>
          </div>

          <Button
            className={styles.filterButton}
            variant="secondary"
            type="button"
            onClick={() => append({})}
            data-testid="add-filter-button"
          >
            {Messages.filter.addButton}
          </Button>
          {fields.map((name, index) => (
            <div key={name.id} className={styles.filterRowWrapper} data-testid="filter-fields-row">
              <div className={styles.filterFields}>
                <Field
                  error={errors.filters?.[index]?.label?.message}
                  invalid={!!errors.filters?.[index]?.label?.message}
                >
                  <Input
                    {...register(`filters[${index}].label`, {
                      required: { value: true, message: Messages.errors.filterLabel },
                    })}
                    placeholder={Messages.filter.fieldLabel}
                  />
                </Field>
              </div>

              <div className={styles.filterFields}>
                <Field
                  error={errors.filters?.[index]?.type?.message}
                  invalid={!!errors.filters?.[index]?.type?.message}
                >
                  <Controller
                    name={`filters[${index}].type`}
                    rules={{ required: { value: true, message: Messages.errors.operatorRequired } }}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        onChange={(e) => onChange(e.value)}
                        value={value}
                        options={filterOptions}
                        placeholder={Messages.filter.fieldOperators}
                      />
                    )}
                  />
                </Field>
              </div>
              <div className={styles.filterFields}>
                <Field
                  error={errors.filters?.[index]?.regexp?.message}
                  invalid={!!errors.filters?.[index]?.regexp?.message}
                >
                  <Input
                    {...register(`filters[${index}].regexp`, {
                      required: { value: true, message: Messages.errors.filterRegex },
                    })}
                    placeholder={Messages.filter.fieldRegex}
                  />
                </Field>
              </div>
              <Button
                aria-label="delete label"
                icon="trash-alt"
                variant="secondary"
                onClick={() => {
                  remove(index);
                }}
              />
            </div>
          ))}
        </>
      )}
    </FieldArray>
  );
};

export default TemplateFiltersField;
