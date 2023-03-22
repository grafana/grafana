import React, { FC, useState } from 'react';

import { Button, Collapse, Field, Form, InputControl, Link, MultiSelect, Select, useStyles2 } from '@grafana/ui';

import { FormAmRoute } from '../../types/amroutes';
import {
  commonGroupByOptions,
  mapMultiSelectValueToStrings,
  mapSelectValueToString,
  promDurationValidator,
  stringsToSelectableValues,
  stringToSelectableValue,
} from '../../utils/amroutes';
import { makeAMLink } from '../../utils/misc';
import { AmRouteReceiver } from '../receivers/grafanaAppReceivers/types';

import { PromDurationInput } from './PromDurationInput';
import { getFormStyles } from './formStyles';
import { TIMING_OPTIONS_DEFAULTS } from './timingOptions';

export interface AmRootRouteFormProps {
  alertManagerSourceName: string;
  onCancel: () => void;
  onSave: (data: FormAmRoute) => void;
  receivers: AmRouteReceiver[];
  routes: FormAmRoute;
}

export const AmRootRouteForm: FC<AmRootRouteFormProps> = ({
  alertManagerSourceName,
  onCancel,
  onSave,
  receivers,
  routes,
}) => {
  const styles = useStyles2(getFormStyles);
  const [isTimingOptionsExpanded, setIsTimingOptionsExpanded] = useState(false);
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues(routes.groupBy));

  return (
    <Form defaultValues={{ ...routes, overrideTimings: true, overrideGrouping: true }} onSubmit={onSave}>
      {({ register, control, errors, setValue }) => (
        <>
          <Field label="Default contact point" invalid={!!errors.receiver} error={errors.receiver?.message}>
            <>
              <div className={styles.container} data-testid="am-receiver-select">
                <InputControl
                  render={({ field: { onChange, ref, ...field } }) => (
                    <Select
                      aria-label="Default contact point"
                      {...field}
                      className={styles.input}
                      onChange={(value) => onChange(mapSelectValueToString(value))}
                      options={receivers}
                    />
                  )}
                  control={control}
                  name="receiver"
                  rules={{ required: { value: true, message: 'Required.' } }}
                />
                <span>or</span>
                <Link
                  className={styles.linkText}
                  href={makeAMLink('/alerting/notifications/receivers/new', alertManagerSourceName)}
                >
                  Create a contact point
                </Link>
              </div>
            </>
          </Field>
          <Field
            label="Group by"
            description="Group alerts when you receive a notification based on labels."
            data-testid="am-group-select"
          >
            {/* @ts-ignore-check: react-hook-form made me do this */}
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <MultiSelect
                  aria-label="Group by"
                  {...field}
                  allowCustomValue
                  className={styles.input}
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
          <Collapse
            collapsible
            className={styles.collapse}
            isOpen={isTimingOptionsExpanded}
            label="Timing options"
            onToggle={setIsTimingOptionsExpanded}
          >
            <div className={styles.timingFormContainer}>
              <Field
                label="Group wait"
                description="The waiting time until the initial notification is sent for a new group created by an incoming alert. Default 30 seconds."
                invalid={!!errors.groupWaitValue}
                error={errors.groupWaitValue?.message}
                data-testid="am-group-wait"
              >
                <PromDurationInput
                  {...register('groupWaitValue', { validate: promDurationValidator })}
                  placeholder={TIMING_OPTIONS_DEFAULTS.group_wait}
                  className={styles.promDurationInput}
                  aria-label="Group wait"
                />
              </Field>
              <Field
                label="Group interval"
                description="The waiting time to send a batch of new alerts for that group after the first notification was sent. Default 5 minutes."
                invalid={!!errors.groupIntervalValue}
                error={errors.groupIntervalValue?.message}
                data-testid="am-group-interval"
              >
                <PromDurationInput
                  {...register('groupIntervalValue', { validate: promDurationValidator })}
                  placeholder={TIMING_OPTIONS_DEFAULTS.group_interval}
                  className={styles.promDurationInput}
                  aria-label="Group interval"
                />
              </Field>
              <Field
                label="Repeat interval"
                description="The waiting time to resend an alert after they have successfully been sent. Default 4 hours."
                invalid={!!errors.repeatIntervalValue}
                error={errors.repeatIntervalValue?.message}
                data-testid="am-repeat-interval"
              >
                <PromDurationInput
                  {...register('repeatIntervalValue', { validate: promDurationValidator })}
                  placeholder={TIMING_OPTIONS_DEFAULTS.repeat_interval}
                  className={styles.promDurationInput}
                  aria-label="Repeat interval"
                />
              </Field>
            </div>
          </Collapse>
          <div className={styles.container}>
            <Button type="submit">Save</Button>
            <Button onClick={onCancel} type="reset" variant="secondary" fill="outline">
              Cancel
            </Button>
          </div>
        </>
      )}
    </Form>
  );
};
