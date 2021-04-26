import React, { FC, useState } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { Button, Collapse, Field, Form, Input, InputControl, Link, MultiSelect, Select, useStyles } from '@grafana/ui';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';
import { AmRouteFormValues } from '../../types/amroutes';
import { mapStringToSelectableValue, optionalPositiveInteger } from '../../utils/amroutes';
import { timeOptions } from '../../utils/time';

export interface AmRootRouteFormProps {
  onCancel: () => void;
  receivers: Array<SelectableValue<Receiver['name']>>;
  routes: AmRouteFormValues;
}

export const AmRootRouteForm: FC<AmRootRouteFormProps> = ({ onCancel, receivers, routes }) => {
  const styles = useStyles(getStyles);
  const [isTimingOptionsExpanded, setIsTimingOptionsExpanded] = useState(false);
  const [groupByOptions, setGroupByOptions] = useState(routes.groupBy);

  return (
    <Form defaultValues={routes} onSubmit={(data) => console.log(data)}>
      {({ control, getValues }) => (
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
                const newOpt = mapStringToSelectableValue(opt);

                setGroupByOptions((groupByOptions) => [...groupByOptions, newOpt]);

                control.setValue('groupBy', [...getValues().groupBy, newOpt]);
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
                  rules={{
                    validate: optionalPositiveInteger,
                  }}
                  name="groupWaitValue"
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
                  rules={{
                    validate: optionalPositiveInteger,
                  }}
                  name="groupIntervalValue"
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
                  rules={{
                    validate: optionalPositiveInteger,
                  }}
                  name="repeatIntervalValue"
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
            <Button onClick={onCancel} type="reset" variant="secondary">
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
