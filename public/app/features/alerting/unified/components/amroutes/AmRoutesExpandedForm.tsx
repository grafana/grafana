import { css } from '@emotion/css';
import React, { FC, useState } from 'react';

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
  Badge,
  VerticalGroup,
} from '@grafana/ui';

import { useMuteTimingOptions } from '../../hooks/useMuteTimingOptions';
import { FormAmRoute } from '../../types/amroutes';
import { SupportedPlugin } from '../../types/pluginBridges';
import { matcherFieldOptions } from '../../utils/alertmanager';
import {
  emptyArrayFieldMatcher,
  mapMultiSelectValueToStrings,
  mapSelectValueToString,
  stringToSelectableValue,
  stringsToSelectableValues,
  commonGroupByOptions,
  promDurationValidator,
} from '../../utils/amroutes';
import { AmRouteReceiver } from '../receivers/grafanaAppReceivers/types';

import { PromDurationInput } from './PromDurationInput';
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
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues(routes.groupBy));
  const muteTimingOptions = useMuteTimingOptions();

  const receiversWithOnCallOnTop = receivers.sort((receiver1, receiver2) => {
    if (receiver1.grafanaAppReceiverType === SupportedPlugin.OnCall) {
      return -1;
    } else {
      return 0;
    }
  });

  return (
    <Form defaultValues={routes} onSubmit={onSave}>
      {({ control, register, errors, setValue, watch }) => (
        <>
          {/* @ts-ignore-check: react-hook-form made me do this */}
          <input type="hidden" {...register('id')} />
          {/* @ts-ignore-check: react-hook-form made me do this */}
          <FieldArray name="object_matchers" control={control}>
            {({ fields, append, remove }) => (
              <>
                <VerticalGroup justify="flex-start" spacing="md">
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
                        return (
                          <HorizontalGroup key={field.id} align="flex-start" height="auto">
                            <Field
                              label="Label"
                              invalid={!!errors.object_matchers?.[index]?.name}
                              error={errors.object_matchers?.[index]?.name?.message}
                            >
                              <Input
                                {...register(`object_matchers.${index}.name`, { required: 'Field is required' })}
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
                                name={`object_matchers.${index}.operator`}
                                rules={{ required: { value: true, message: 'Required.' } }}
                              />
                            </Field>
                            <Field
                              label="Value"
                              invalid={!!errors.object_matchers?.[index]?.value}
                              error={errors.object_matchers?.[index]?.value?.message}
                            >
                              <Input
                                {...register(`object_matchers.${index}.value`, { required: 'Field is required' })}
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
                </VerticalGroup>
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
                  options={receiversWithOnCallOnTop}
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
                <PromDurationInput
                  {...register('groupWaitValue', { validate: promDurationValidator })}
                  aria-label="Group wait value"
                  className={formStyles.promDurationInput}
                />
              </Field>
              <Field
                label="Group interval"
                description="The waiting time to send a batch of new alerts for that group after the first notification was sent. If empty it will be inherited from the parent policy."
                invalid={!!errors.groupIntervalValue}
                error={errors.groupIntervalValue?.message}
              >
                <PromDurationInput
                  {...register('groupIntervalValue', { validate: promDurationValidator })}
                  aria-label="Group interval value"
                  className={formStyles.promDurationInput}
                />
              </Field>
              <Field
                label="Repeat interval"
                description="The waiting time to resend an alert after they have successfully been sent."
                invalid={!!errors.repeatIntervalValue}
                error={errors.repeatIntervalValue?.message}
              >
                <PromDurationInput
                  {...register('repeatIntervalValue', { validate: promDurationValidator })}
                  aria-label="Repeat interval value"
                  className={formStyles.promDurationInput}
                />
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
    noMatchersWarning: css`
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
    `,
  };
};
