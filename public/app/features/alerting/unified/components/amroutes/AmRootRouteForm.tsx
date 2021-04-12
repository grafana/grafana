import React, { FC, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { Button, Collapse, Field, Form, Input, InputControl, Link, Select, useStyles } from '@grafana/ui';
import { Route } from 'app/plugins/datasource/alertmanager/types';

const intervalTypeOptions: SelectableValue[] = [
  {
    label: 'seconds',
    value: 'seconds',
  },
  {
    label: 'minutes',
    value: 'minutes',
  },
  {
    label: 'hours',
    value: 'hours',
  },
];

const groupByOptions: SelectableValue[] = [
  {
    label: 'cluster',
    value: 'cluster',
  },
  {
    label: 'alertname',
    value: 'alertname',
  },
  {
    label: 'service',
    value: 'service',
  },
  {
    label: 'product',
    value: 'product',
  },
  {
    label: 'environment',
    value: 'environment',
  },
  {
    label: '...',
    value: '...',
  },
];

export interface AmRootRouteFormProps {
  onCancel: () => void;
  route: Route | undefined;
}

export const AmRootRouteForm: FC<AmRootRouteFormProps> = ({ onCancel }) => {
  const styles = useStyles(getStyles);
  const [isTimingOptionsExpanded, setIsTimingOptionsExpanded] = useState(false);

  return (
    <Form onSubmit={() => undefined}>
      {({ control }) => (
        <>
          <Field label="Default notification channel">
            <div className={styles.container}>
              <InputControl
                as={Select}
                className={styles.input}
                control={control}
                name="defaultNotificationChannel"
                onChange={() => undefined}
                options={[]}
              />
              <span>or</span>
              <Link href="#">Create a notification channel</Link>
            </div>
          </Field>
          <Field label="Group by" description="Group alerts when you receive a notification based on labels.">
            <InputControl
              as={Select}
              className={styles.input}
              control={control}
              name="groupBy"
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
              <div className={styles.container}>
                <InputControl as={Input} className={styles.smallInput} control={control} name="groupWaitValue" />
                <InputControl
                  as={Select}
                  className={styles.input}
                  control={control}
                  defaultValue={intervalTypeOptions[0]}
                  name="groupWaitValueType"
                  options={intervalTypeOptions}
                />
              </div>
            </Field>
            <Field
              label="Group interval"
              description="The waiting time to send a batch of new alerts for that group after the first notification was sent."
            >
              <div className={styles.container}>
                <InputControl as={Input} className={styles.smallInput} control={control} name="groupIntervalValue" />
                <InputControl
                  as={Select}
                  className={styles.input}
                  control={control}
                  defaultValue={intervalTypeOptions[0]}
                  name="groupIntervalValueType"
                  options={intervalTypeOptions}
                />
              </div>
            </Field>
            <Field
              label="Repeat interval"
              description="The waiting time to resend an alert after they have successfully been sent."
            >
              <div className={styles.container}>
                <InputControl as={Input} className={styles.smallInput} control={control} name="repeatIntervalValue" />
                <InputControl
                  as={Select}
                  className={styles.input}
                  control={control}
                  defaultValue={intervalTypeOptions[0]}
                  menuPlacement="top"
                  name="repeatIntervalValueType"
                  options={intervalTypeOptions}
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

      > * + * {
        margin-left: ${theme.spacing.sm};
      }
    `,
    input: css`
      flex: 1;
    `,
    smallInput: css`
      flex: 0.1;
    `,
  };
};
