import React, { FC, useState } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { Button, Collapse, Field, Form, Input, InputControl, Link, MultiSelect, Select, useStyles } from '@grafana/ui';
import { Receiver, Route } from 'app/plugins/datasource/alertmanager/types';
import { parseInterval, timeOptions } from '../../utils/time';

export interface AmRootRouteFormProps {
  onCancel: () => void;
  receivers: Array<SelectableValue<Receiver['name']>>;
  route: Route | undefined;
}

export const AmRootRouteForm: FC<AmRootRouteFormProps> = ({ onCancel, receivers, route }) => {
  const styles = useStyles(getStyles);
  const [isTimingOptionsExpanded, setIsTimingOptionsExpanded] = useState(false);
  const [groupByOptions, setGroupByOptions] = useState(
    (route?.group_by ?? []).map((opt) => ({
      label: opt,
      value: opt,
    }))
  );

  const [groupWaitValue, groupWaitValueType] = route?.group_wait
    ? parseInterval(route?.group_wait)
    : [undefined, undefined];

  const [groupIntervalValue, groupIntervalValueType] = route?.group_interval
    ? parseInterval(route?.group_interval)
    : [undefined, undefined];

  const [repeatIntervalValue, repeatIntervalValueType] = route?.repeat_interval
    ? parseInterval(route?.repeat_interval)
    : [undefined, undefined];

  const defaultValue = {
    receiver: route?.receiver,
    groupBy: route?.group_by,
    groupWaitValue,
    groupWaitValueType,
    groupIntervalValue,
    groupIntervalValueType,
    repeatIntervalValue,
    repeatIntervalValueType,
  };

  return (
    <Form defaultValues={defaultValue} onSubmit={() => undefined}>
      {({ control }) => (
        <>
          <Field label="Default notification channel">
            <div className={styles.container}>
              <InputControl
                as={Select}
                className={styles.input}
                control={control}
                name="receiver"
                options={receivers}
              />
              <span>or</span>
              <Link href="#">Create a notification channel</Link>
            </div>
          </Field>
          <Field label="Group by" description="Group alerts when you receive a notification based on labels.">
            <InputControl
              allowCustomValue
              as={MultiSelect}
              className={styles.input}
              control={control}
              name="groupBy"
              onCreateOption={(opt: string) => {
                setGroupByOptions([
                  ...groupByOptions,
                  {
                    label: opt,
                    value: opt,
                  },
                ]);

                control.setValue('groupBy', [...(control.getValues().groupBy ?? []), opt]);
              }}
              options={groupByOptions}
            />
          </Field>
          <Collapse
            collapsible
            isOpen={isTimingOptionsExpanded}
            label="Timing options"
            onToggle={setIsTimingOptionsExpanded}
          >
            <Field
              label="Group wait"
              description="The waiting time until the initial notification is sent for a new group created by an incoming alert."
            >
              <div className={cx(styles.container, styles.timingContainer)}>
                <InputControl
                  as={Input}
                  className={styles.smallInput}
                  control={control}
                  name="groupWaitValue"
                  type="number"
                />
                <InputControl
                  as={Select}
                  className={styles.input}
                  control={control}
                  name="groupWaitValueType"
                  options={timeOptions}
                />
              </div>
            </Field>
            <Field
              label="Group interval"
              description="The waiting time to send a batch of new alerts for that group after the first notification was sent."
            >
              <div className={cx(styles.container, styles.timingContainer)}>
                <InputControl
                  as={Input}
                  className={styles.smallInput}
                  control={control}
                  name="groupIntervalValue"
                  type="number"
                />
                <InputControl
                  as={Select}
                  className={styles.input}
                  control={control}
                  name="groupIntervalValueType"
                  options={timeOptions}
                />
              </div>
            </Field>
            <Field
              label="Repeat interval"
              description="The waiting time to resend an alert after they have successfully been sent."
            >
              <div className={cx(styles.container, styles.timingContainer)}>
                <InputControl
                  as={Input}
                  className={styles.smallInput}
                  control={control}
                  name="repeatIntervalValue"
                  type="number"
                />
                <InputControl
                  as={Select}
                  className={styles.input}
                  control={control}
                  menuPlacement="top"
                  name="repeatIntervalValueType"
                  options={timeOptions}
                />
              </div>
            </Field>
          </Collapse>
          <div className={styles.container}>
            <Button type="submit">Save</Button>
            <Button onClick={onCancel} variant="secondary">
              Cancel
            </Button>
          </div>
        </>
      )}
    </Form>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      align-items: center;
      display: flex;
      flex-flow: row nowrap;

      & > * + * {
        margin-left: ${theme.spacing.sm};
      }
    `,
    input: css`
      flex: 1;
    `,
    timingContainer: css`
      max-width: 264px;
    `,
    smallInput: css`
      width: 52px;
    `,
  };
};
