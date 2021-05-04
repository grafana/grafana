import React, { FC, useState } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  Checkbox,
  Field,
  FieldArray,
  Form,
  HorizontalGroup,
  Input,
  InputControl,
  MultiSelect,
  Select,
  Switch,
  useStyles2,
} from '@grafana/ui';
import { AmRouteReceiver, FormAmRoute } from '../../types/amroutes';
import {
  emptyArrayFieldMatcher,
  mapMultiSelectValueToStrings,
  mapSelectValueToString,
  optionalPositiveInteger,
  stringToSelectableValue,
  stringsToSelectableValues,
} from '../../utils/amroutes';
import { timeOptions } from '../../utils/time';
import { getFormStyles } from './formStyles';

export interface AmRoutesExpandedFormProps {
  onCancel: () => void;
  onSave: (data: FormAmRoute) => void;
  receivers: AmRouteReceiver[];
  routes: FormAmRoute;
}

export const AmRoutesExpandedForm: FC<AmRoutesExpandedFormProps> = ({ onCancel, onSave, receivers, routes }) => {
  const styles = useStyles2(getStyles);
  const formStyles = useStyles2(getFormStyles);
  const [overrideGrouping, setOverrideGrouping] = useState(routes.groupBy.length > 0);
  const [overrideTimings, setOverrideTimings] = useState(
    !!routes.groupWaitValue || !!routes.groupIntervalValue || !!routes.repeatIntervalValue
  );
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues(routes.groupBy));

  return (
    <Form defaultValues={routes} onSubmit={onSave}>
      {({ control, register, errors, setValue }) => (
        <>
          {/* @ts-ignore-check: react-hook-form made me do this */}
          <FieldArray name="matchers" control={control}>
            {({ fields, append }) => (
              <>
                <div>Matchers</div>
                <div className={styles.matchersContainer}>
                  {fields.map((field, index) => {
                    const localPath = `matchers[${index}]`;

                    return (
                      <HorizontalGroup key={field.id}>
                        <Field
                          label="Label"
                          invalid={!!errors.matchers?.[index]?.label}
                          error={errors.matchers?.[index]?.label?.message}
                        >
                          <Input
                            {...register(`${localPath}.label`, { required: 'Field is required' })}
                            defaultValue={field.label}
                          />
                        </Field>
                        <span>=</span>
                        <Field
                          label="Value"
                          invalid={!!errors.matchers?.[index]?.value}
                          error={errors.matchers?.[index]?.value?.message}
                        >
                          <Input
                            {...register(`${localPath}.value`, { required: 'Field is required' })}
                            defaultValue={field.value}
                          />
                        </Field>
                        <Field className={styles.matcherRegexField} label="Regex">
                          <Checkbox {...register(`${localPath}.isRegex`)} defaultChecked={field.isRegex} />
                        </Field>
                      </HorizontalGroup>
                    );
                  })}
                </div>
                <Button
                  className={styles.addMatcherBtn}
                  icon="plus"
                  onClick={() => append(emptyArrayFieldMatcher)}
                  variant="secondary"
                  type="button"
                >
                  Add matcher
                </Button>
              </>
            )}
          </FieldArray>
          <Field label="Contact point">
            {/* @ts-ignore-check: react-hook-form made me do this */}
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <Select
                  {...field}
                  className={formStyles.input}
                  onChange={(value) => onChange(mapSelectValueToString(value))}
                  options={receivers}
                />
              )}
              control={control}
              name="receiver"
            />
          </Field>
          <Field label="Continue matching subsequent sibling nodes">
            <Switch {...register('continue')} />
          </Field>
          <Field label="Override grouping">
            <Switch
              value={overrideGrouping}
              onChange={() => setOverrideGrouping((overrideGrouping) => !overrideGrouping)}
            />
          </Field>
          {overrideGrouping && (
            <Field label="Group by" description="Group alerts when you receive a notification based on labels.">
              <InputControl
                render={({ field: { onChange, ref, ...field } }) => (
                  <MultiSelect
                    {...field}
                    allowCustomValue
                    className={formStyles.input}
                    onCreateOption={(opt: string) => {
                      setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);

                      // @ts-ignore-check: react-hook-form made me do this
                      setValue('groupBy', [...field.value, opt]);
                    }}
                    onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
                    options={groupByOptions}
                  />
                )}
                control={control}
                name="groupBy"
              />
            </Field>
          )}
          <Field label="Override general timings">
            <Switch
              value={overrideTimings}
              onChange={() => setOverrideTimings((overrideTimings) => !overrideTimings)}
            />
          </Field>
          {overrideTimings && (
            <>
              <Field
                label="Group wait"
                description="The waiting time until the initial notification is sent for a new group created by an incoming alert."
                invalid={!!errors.groupWaitValue}
                error={errors.groupWaitValue?.message}
              >
                <>
                  <div className={cx(formStyles.container, formStyles.timingContainer)}>
                    <InputControl
                      render={({ field, fieldState: { invalid } }) => (
                        <Input {...field} className={formStyles.smallInput} invalid={invalid} />
                      )}
                      control={control}
                      name="groupWaitValue"
                      rules={{
                        validate: optionalPositiveInteger,
                      }}
                    />
                    <InputControl
                      render={({ field: { onChange, ref, ...field } }) => (
                        <Select
                          {...field}
                          className={formStyles.input}
                          onChange={(value) => onChange(mapSelectValueToString(value))}
                          options={timeOptions}
                        />
                      )}
                      control={control}
                      name="groupWaitValueType"
                    />
                  </div>
                </>
              </Field>
              <Field
                label="Group interval"
                description="The waiting time to send a batch of new alerts for that group after the first notification was sent."
                invalid={!!errors.groupIntervalValue}
                error={errors.groupIntervalValue?.message}
              >
                <>
                  <div className={cx(formStyles.container, formStyles.timingContainer)}>
                    <InputControl
                      render={({ field, fieldState: { invalid } }) => (
                        <Input {...field} className={formStyles.smallInput} invalid={invalid} />
                      )}
                      control={control}
                      name="groupIntervalValue"
                      rules={{
                        validate: optionalPositiveInteger,
                      }}
                    />
                    <InputControl
                      render={({ field: { onChange, ref, ...field } }) => (
                        <Select
                          {...field}
                          className={formStyles.input}
                          onChange={(value) => onChange(mapSelectValueToString(value))}
                          options={timeOptions}
                        />
                      )}
                      control={control}
                      name="groupIntervalValueType"
                    />
                  </div>
                </>
              </Field>
              <Field
                label="Repeat interval"
                description="The waiting time to resend an alert after they have successfully been sent."
                invalid={!!errors.repeatIntervalValue}
                error={errors.repeatIntervalValue?.message}
              >
                <>
                  <div className={cx(formStyles.container, formStyles.timingContainer)}>
                    <InputControl
                      render={({ field, fieldState: { invalid } }) => (
                        <Input {...field} className={formStyles.smallInput} invalid={invalid} />
                      )}
                      control={control}
                      name="repeatIntervalValue"
                      rules={{
                        validate: optionalPositiveInteger,
                      }}
                    />
                    <InputControl
                      render={({ field: { onChange, ref, ...field } }) => (
                        <Select
                          {...field}
                          className={formStyles.input}
                          menuPlacement="top"
                          onChange={(value) => onChange(mapSelectValueToString(value))}
                          options={timeOptions}
                        />
                      )}
                      control={control}
                      name="repeatIntervalValueType"
                    />
                  </div>
                </>
              </Field>
            </>
          )}
          <div className={styles.buttonGroup}>
            <Button type="submit">Save policy</Button>
            <Button onClick={onCancel} type="button" variant="secondary">
              Cancel
            </Button>
          </div>
        </>
      )}
    </Form>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const commonSpacing = theme.spacing(3.5);

  return {
    addMatcherBtn: css`
      margin-bottom: ${commonSpacing};
    `,
    matchersContainer: css`
      background-color: ${theme.colors.background.secondary};
      margin: ${theme.spacing(1, 0)};
      padding: ${theme.spacing(1, 4.6, 1, 1.5)};
      width: fit-content;
    `,
    matcherRegexField: css`
      margin-left: ${theme.spacing(6)};
    `,
    nestedPolicies: css`
      margin-top: ${commonSpacing};
    `,
    buttonGroup: css`
      margin: ${theme.spacing(6)} 0 ${commonSpacing};

      & > * + * {
        margin-left: ${theme.spacing(1.5)};
      }
    `,
  };
};
