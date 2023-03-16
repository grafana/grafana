import { cx } from '@emotion/css';
import React, { ReactNode, useState } from 'react';

import { Collapse, Field, Form, Input, InputControl, Link, MultiSelect, Select, useStyles2 } from '@grafana/ui';
import { RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../../types/amroutes';
import {
  mapMultiSelectValueToStrings,
  mapSelectValueToString,
  optionalPositiveInteger,
  stringToSelectableValue,
  stringsToSelectableValues,
  commonGroupByOptions,
  amRouteToFormAmRoute,
} from '../../utils/amroutes';
import { makeAMLink } from '../../utils/misc';
import { timeOptions } from '../../utils/time';
import { AmRouteReceiver } from '../receivers/grafanaAppReceivers/types';

import { getFormStyles } from './formStyles';

export interface AmRootRouteFormProps {
  alertManagerSourceName: string;
  actionButtons: ReactNode;
  onSubmit: (route: Partial<FormAmRoute>) => void;
  receivers: AmRouteReceiver[];
  route: RouteWithID;
}

export const AmRootRouteForm = ({
  actionButtons,
  alertManagerSourceName,
  onSubmit,
  receivers,
  route,
}: AmRootRouteFormProps) => {
  const styles = useStyles2(getFormStyles);
  const [isTimingOptionsExpanded, setIsTimingOptionsExpanded] = useState(false);
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues(route.group_by));

  const defaultValues = amRouteToFormAmRoute(route);

  return (
    <Form defaultValues={{ ...defaultValues, overrideTimings: true, overrideGrouping: true }} onSubmit={onSubmit}>
      {({ control, errors, setValue }) => (
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
            <Field
              label="Group wait"
              description="The waiting time until the initial notification is sent for a new group created by an incoming alert. Default 30 seconds."
              invalid={!!errors.groupWaitValue}
              error={errors.groupWaitValue?.message}
              data-testid="am-group-wait"
            >
              <>
                <div className={cx(styles.container, styles.timingContainer)}>
                  <InputControl
                    render={({ field, fieldState: { invalid } }) => (
                      <Input {...field} className={styles.smallInput} invalid={invalid} placeholder={'30'} />
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
                        className={styles.input}
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
              description="The waiting time to send a batch of new alerts for that group after the first notification was sent. Default 5 minutes."
              invalid={!!errors.groupIntervalValue}
              error={errors.groupIntervalValue?.message}
              data-testid="am-group-interval"
            >
              <>
                <div className={cx(styles.container, styles.timingContainer)}>
                  <InputControl
                    render={({ field, fieldState: { invalid } }) => (
                      <Input {...field} className={styles.smallInput} invalid={invalid} placeholder={'5'} />
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
                        className={styles.input}
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
              description="The waiting time to resend an alert after they have successfully been sent. Default 4 hours."
              invalid={!!errors.repeatIntervalValue}
              error={errors.repeatIntervalValue?.message}
              data-testid="am-repeat-interval"
            >
              <>
                <div className={cx(styles.container, styles.timingContainer)}>
                  <InputControl
                    render={({ field, fieldState: { invalid } }) => (
                      <Input {...field} className={styles.smallInput} invalid={invalid} placeholder="4" />
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
                        className={styles.input}
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
          </Collapse>
          <div className={styles.container}>{actionButtons}</div>
        </>
      )}
    </Form>
  );
};
