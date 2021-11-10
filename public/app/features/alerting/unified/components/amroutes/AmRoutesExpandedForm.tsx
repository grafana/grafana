import React, { FC, useState } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  Field,
  FieldArray,
  Form,
  HorizontalGroup,
  IconButton,
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
import { matcherFieldOptions } from '../../utils/alertmanager';
import { useMuteTimingOptions } from '../../hooks/useMuteTimingOptions';

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
  const muteTimingOptions = useMuteTimingOptions();

  return (
    <Form defaultValues={routes} onSubmit={onSave}>
      {({ control, register, errors, setValue }) => (
        <>
          {/* @ts-ignore-check: react-hook-form made me do this */}
          <input type="hidden" {...register('id')} />
          {/* @ts-ignore-check: react-hook-form made me do this */}
          <FieldArray name="object_matchers" control={control}>
            {({ fields, append, remove }) => (
              <>
                <div>Matching labels</div>
                <div className={styles.matchersContainer}>
                  {fields.map((field, index) => {
                    const localPath = `object_matchers[${index}]`;
                    return (
                      <HorizontalGroup key={field.id} align="flex-start">
                        <Field
                          label="Label"
                          invalid={!!errors.object_matchers?.[index]?.name}
                          error={errors.object_matchers?.[index]?.name?.message}
                        >
                          <Input
                            {...register(`${localPath}.name`, { required: 'Field is required' })}
                            defaultValue={field.name}
                            placeholder="label"
                          />
                        </Field>
                        <Field label={'Operator'}>
                          <InputControl
                            render={({ field: { onChange, ref, ...field } }) => (
                              <Select
                                {...field}
                                className={styles.matchersOperator}
                                onChange={(value) => onChange(value?.value)}
                                options={matcherFieldOptions}
                                aria-label="Operator"
                              />
                            )}
                            defaultValue={field.operator}
                            control={control}
                            name={`${localPath}.operator` as const}
                            rules={{ required: { value: true, message: 'Required.' } }}
                          />
                        </Field>
                        <Field
                          label="Value"
                          invalid={!!errors.object_matchers?.[index]?.value}
                          error={errors.object_matchers?.[index]?.value?.message}
                        >
                          <Input
                            {...register(`${localPath}.value`, { required: 'Field is required' })}
                            defaultValue={field.value}
                            placeholder="value"
                          />
                        </Field>
                        <IconButton
                          className={styles.removeButton}
                          tooltip="Remove matcher"
                          name={'trash-alt'}
                          onClick={() => remove(index)}
                        >
                          Remove
                        </IconButton>
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
                  aria-label="Contact point"
                  {...field}
                  className={formStyles.input}
                  onChange={(value) => onChange(mapSelectValueToString(value))}
                  options={receivers}
                  menuShouldPortal
                />
              )}
              control={control}
              name="receiver"
            />
          </Field>
          <Field label="Continue matching subsequent sibling nodes">
            <Switch id="continue-toggle" {...register('continue')} />
          </Field>
          <Field label="Override grouping">
            <Switch
              id="override-grouping-toggle"
              value={overrideGrouping}
              onChange={() => setOverrideGrouping((overrideGrouping) => !overrideGrouping)}
            />
          </Field>
          {overrideGrouping && (
            <Field label="Group by" description="Group alerts when you receive a notification based on labels.">
              <InputControl
                render={({ field: { onChange, ref, ...field } }) => (
                  <MultiSelect
                    aria-label="Group by"
                    menuShouldPortal
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
              id="override-timings-toggle"
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
                        <Input
                          {...field}
                          className={formStyles.smallInput}
                          invalid={invalid}
                          placeholder="Time"
                          aria-label="Group wait value"
                        />
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
                          menuShouldPortal
                          {...field}
                          className={formStyles.input}
                          onChange={(value) => onChange(mapSelectValueToString(value))}
                          options={timeOptions}
                          aria-label="Group wait type"
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
                        <Input
                          {...field}
                          className={formStyles.smallInput}
                          invalid={invalid}
                          placeholder="Time"
                          aria-label="Group interval value"
                        />
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
                          menuShouldPortal
                          {...field}
                          className={formStyles.input}
                          onChange={(value) => onChange(mapSelectValueToString(value))}
                          options={timeOptions}
                          aria-label="Group interval type"
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
                        <Input
                          {...field}
                          className={formStyles.smallInput}
                          invalid={invalid}
                          placeholder="Time"
                          aria-label="Repeat interval value"
                        />
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
                          menuShouldPortal
                          {...field}
                          className={formStyles.input}
                          menuPlacement="top"
                          onChange={(value) => onChange(mapSelectValueToString(value))}
                          options={timeOptions}
                          aria-label="Repeat interval type"
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
          <Field label="Mute timings" description="Add mute timing to policy" invalid={!!errors.muteTimeIntervals}>
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <MultiSelect
                  aria-label="Mute timings"
                  menuShouldPortal
                  {...field}
                  className={formStyles.input}
                  onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
                  options={muteTimingOptions}
                />
              )}
              control={control}
              name="muteTimeIntervals"
            />
          </Field>
          <div className={styles.buttonGroup}>
            <Button type="submit">Save policy</Button>
            <Button onClick={onCancel} fill="outline" type="button" variant="secondary">
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
    matchersOperator: css`
      min-width: 140px;
    `,
    nestedPolicies: css`
      margin-top: ${commonSpacing};
    `,
    removeButton: css`
      margin-left: ${theme.spacing(1)};
      margin-top: ${theme.spacing(2.5)};
    `,
    buttonGroup: css`
      margin: ${theme.spacing(6)} 0 ${commonSpacing};

      & > * + * {
        margin-left: ${theme.spacing(1.5)};
      }
    `,
  };
};
