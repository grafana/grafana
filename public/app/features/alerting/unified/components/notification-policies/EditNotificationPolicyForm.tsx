import { css, cx } from '@emotion/css';
import React, { ReactNode, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import {
  Button,
  Field,
  FieldArray,
  Form,
  IconButton,
  Input,
  InputControl,
  MultiSelect,
  Select,
  Switch,
  useStyles2,
  Badge,
} from '@grafana/ui';
import { MatcherOperator, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { useMuteTimingOptions } from '../../hooks/useMuteTimingOptions';
import { FormAmRoute } from '../../types/amroutes';
import { SupportedPlugin } from '../../types/pluginBridges';
import { matcherFieldOptions } from '../../utils/alertmanager';
import {
  emptyArrayFieldMatcher,
  mapMultiSelectValueToStrings,
  mapSelectValueToString,
  optionalPositiveInteger,
  stringToSelectableValue,
  stringsToSelectableValues,
  commonGroupByOptions,
  amRouteToFormAmRoute,
} from '../../utils/amroutes';
import { timeOptions } from '../../utils/time';
import { AmRouteReceiver } from '../receivers/grafanaAppReceivers/types';

import { getFormStyles } from './formStyles';

export interface AmRoutesExpandedFormProps {
  receivers: AmRouteReceiver[];
  route?: RouteWithID;
  onSubmit: (route: Partial<FormAmRoute>) => void;
  actionButtons: ReactNode;
}

export const AmRoutesExpandedForm = ({ actionButtons, receivers, route, onSubmit }: AmRoutesExpandedFormProps) => {
  const styles = useStyles2(getStyles);
  const formStyles = useStyles2(getFormStyles);
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues(route?.group_by));
  const muteTimingOptions = useMuteTimingOptions();

  const receiversWithOnCallOnTop = receivers.sort(onCallFirst);

  const formAmRoute = amRouteToFormAmRoute(route);

  const emptyMatcher = [{ name: '', operator: MatcherOperator.equal, value: '' }];

  const defaultValues: FormAmRoute = {
    ...formAmRoute,
    // if we're adding a new route, show at least one empty matcher
    object_matchers: route ? formAmRoute.object_matchers : emptyMatcher,
  };

  return (
    <Form defaultValues={defaultValues} onSubmit={onSubmit} maxWidth="none">
      {({ control, register, errors, setValue, watch }) => (
        <>
          {/* @ts-ignore-check: react-hook-form made me do this */}
          <input type="hidden" {...register('id')} />
          {/* @ts-ignore-check: react-hook-form made me do this */}
          <FieldArray name="object_matchers" control={control}>
            {({ fields, append, remove }) => (
              <>
                <Stack direction="column" alignItems="flex-start">
                  <div>Matching labels</div>
                  {fields.length === 0 && (
                    <Badge
                      color="orange"
                      className={styles.noMatchersWarning}
                      icon="exclamation-triangle"
                      text="If no matchers are specified, this notification policy will handle all alert instances."
                    />
                  )}
                  {fields.length > 0 && (
                    <div className={styles.matchersContainer}>
                      {fields.map((field, index) => {
                        const localPath = `object_matchers[${index}]`;
                        return (
                          <Stack direction="row" key={field.id} alignItems="center">
                            <Field
                              label="Label"
                              invalid={!!errors.object_matchers?.[index]?.name}
                              error={errors.object_matchers?.[index]?.name?.message}
                            >
                              <Input
                                {...register(`${localPath}.name`, { required: 'Field is required' })}
                                defaultValue={field.name}
                                placeholder="label"
                                autoFocus
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
                              type="button"
                              tooltip="Remove matcher"
                              name={'trash-alt'}
                              onClick={() => remove(index)}
                            >
                              Remove
                            </IconButton>
                          </Stack>
                        );
                      })}
                    </div>
                  )}
                  <Button
                    className={styles.addMatcherBtn}
                    icon="plus"
                    onClick={() => append(emptyArrayFieldMatcher)}
                    variant="secondary"
                    type="button"
                  >
                    Add matcher
                  </Button>
                </Stack>
              </>
            )}
          </FieldArray>
          <Field label="Contact point">
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <Select
                  aria-label="Contact point"
                  {...field}
                  className={formStyles.input}
                  onChange={(value) => onChange(mapSelectValueToString(value))}
                  options={receiversWithOnCallOnTop}
                  isClearable
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
            <Switch id="override-grouping-toggle" {...register('overrideGrouping')} />
          </Field>
          {watch().overrideGrouping && (
            <Field
              label="Group by"
              description="Group alerts when you receive a notification based on labels. If empty it will be inherited from the parent policy."
            >
              <InputControl
                render={({ field: { onChange, ref, ...field } }) => (
                  <MultiSelect
                    aria-label="Group by"
                    {...field}
                    allowCustomValue
                    className={formStyles.input}
                    onCreateOption={(opt: string) => {
                      setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);

                      // @ts-ignore-check: react-hook-form made me do this
                      setValue('groupBy', [...field.value, opt]);
                    }}
                    onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
                    options={[...commonGroupByOptions, ...groupByOptions]}
                  />
                )}
                control={control}
                name="groupBy"
              />
            </Field>
          )}
          <Field label="Override general timings">
            <Switch id="override-timings-toggle" {...register('overrideTimings')} />
          </Field>
          {watch().overrideTimings && (
            <>
              <Field
                label="Group wait"
                description="The waiting time until the initial notification is sent for a new group created by an incoming alert. If empty it will be inherited from the parent policy."
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
                description="The waiting time to send a batch of new alerts for that group after the first notification was sent. If empty it will be inherited from the parent policy."
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
          <Field
            label="Mute timings"
            data-testid="am-mute-timing-select"
            description="Add mute timing to policy"
            invalid={!!errors.muteTimeIntervals}
          >
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <MultiSelect
                  aria-label="Mute timings"
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
          {actionButtons}
        </>
      )}
    </Form>
  );
};

function onCallFirst(receiver: AmRouteReceiver) {
  if (receiver.grafanaAppReceiverType === SupportedPlugin.OnCall) {
    return -1;
  } else {
    return 0;
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  const commonSpacing = theme.spacing(3.5);

  return {
    addMatcherBtn: css`
      margin-bottom: ${commonSpacing};
    `,
    matchersContainer: css`
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(1.5)} ${theme.spacing(2)};
      padding-bottom: 0;
      width: fit-content;
    `,
    matchersOperator: css`
      min-width: 120px;
    `,
    noMatchersWarning: css`
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
    `,
  };
};
