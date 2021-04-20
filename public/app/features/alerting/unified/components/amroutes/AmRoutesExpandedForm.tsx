import React, { FC, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
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
  useStyles,
} from '@grafana/ui';
import { Receiver, Route } from 'app/plugins/datasource/alertmanager/types';
import { parseInterval, timeOptions } from '../../utils/time';
import { AmRoutesTable } from './AmRoutesTable';

export interface AmRoutesExpandedReadProps {
  onExitEditMode: () => void;
  route: Route;
  receivers: Array<SelectableValue<Receiver['name']>>;
}

const prepareMatches = (matches: Record<string, string> | undefined, isRegex: boolean) =>
  Object.entries(matches ?? {}).reduce(
    (acc, [label, value]) => [
      ...acc,
      {
        label,
        value,
        isRegex,
      },
    ],
    []
  );

export const AmRoutesExpandedForm: FC<AmRoutesExpandedReadProps> = ({ onExitEditMode, route, receivers }) => {
  const styles = useStyles(getStyles);
  const [overrideGrouping, setOverrideGrouping] = useState(!!route.group_by);
  const [overrideTimings, setOverrideTimings] = useState(
    !!route.group_wait || !!route.group_interval || !!route.repeat_interval
  );

  const [groupByOptions, setGroupByOptions] = useState(
    (route.group_by ?? []).map((opt) => ({
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

  const defaultValues = {
    matches: [...prepareMatches(route.match, false), ...prepareMatches(route.match_re, true)],
    receiver: route.receiver,
    continue: route.continue,
    groupBy: route.group_by,
    groupWaitValue,
    groupWaitValueType,
    groupIntervalValue,
    groupIntervalValueType,
    repeatIntervalValue,
    repeatIntervalValueType,
  };

  return (
    <>
      <Form onSubmit={() => undefined} defaultValues={defaultValues}>
        {({ control }) => (
          <>
            <FieldArray name="matches" control={control}>
              {({ fields, append }) => (
                <>
                  {fields.map((field, index) => (
                    <HorizontalGroup key={index}>
                      <Field label="Label">
                        <InputControl as={Input} control={control} name={`matches[${index}].label`} />
                      </Field>
                      <Field label="Value">
                        <InputControl as={Input} control={control} name={`matches[${index}].value`} />
                      </Field>
                      <Field label="Regex">
                        <InputControl as={Checkbox} control={control} name={`matches[${index}].isRegex`} />
                      </Field>
                    </HorizontalGroup>
                  ))}
                  <Button className={styles.addMatchBtn} icon="plus" onClick={() => append({})} variant="secondary">
                    Add matcher
                  </Button>
                </>
              )}
            </FieldArray>
            <Field label="Contact point">
              <InputControl as={Select} control={control} name="receiver" options={receivers} />
            </Field>
            <Field label="Continue matching subsequent sibling nodes">
              <InputControl as={Switch} control={control} name="continue" />
            </Field>
            <Field label="Override grouping">
              <Switch
                value={overrideGrouping}
                onChange={() => {
                  setOverrideGrouping(!overrideGrouping);
                }}
              />
            </Field>
            {overrideGrouping && (
              <Field label="Group by" description="Group alerts when you receive a notification based on labels.">
                <InputControl
                  allowCustomValue
                  as={MultiSelect}
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
            )}
            <Field label="Override general timings">
              <Switch
                value={overrideTimings}
                onChange={() => {
                  setOverrideTimings(!overrideTimings);
                }}
              />
            </Field>
            {overrideTimings && (
              <>
                <Field
                  label="Group wait"
                  description="The waiting time until the initial notification is sent for a new group created by an incoming alert."
                >
                  <div>
                    <InputControl as={Input} control={control} name="groupWaitValue" type="number" />
                    <InputControl as={Select} control={control} name="groupWaitValueType" options={timeOptions} />
                  </div>
                </Field>
                <Field
                  label="Group interval"
                  description="The waiting time to send a batch of new alerts for that group after the first notification was sent."
                >
                  <div>
                    <InputControl as={Input} control={control} name="groupIntervalValue" type="number" />
                    <InputControl as={Select} control={control} name="groupIntervalValueType" options={timeOptions} />
                  </div>
                </Field>
                <Field
                  label="Repeat interval"
                  description="The waiting time to resend an alert after they have successfully been sent."
                >
                  <div>
                    <InputControl as={Input} control={control} name="repeatIntervalValue" type="number" />
                    <InputControl
                      as={Select}
                      control={control}
                      menuPlacement="top"
                      name="repeatIntervalValueType"
                      options={timeOptions}
                    />
                  </div>
                </Field>
              </>
            )}
          </>
        )}
      </Form>
      <div className={styles.nestedPolicies}>Nested policies</div>
      {route.routes?.length ? <AmRoutesTable routes={route.routes} receivers={receivers} /> : '-'}
      <div className={styles.buttonGroup}>
        <Button type="submit">Save policy</Button>
        <Button onClick={onExitEditMode} variant="secondary">
          Cancel
        </Button>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    addMatchBtn: css`
      margin-bottom: 28px;
    `,
    nestedPolicies: css`
      margin-top: 28px;
    `,
    buttonGroup: css`
      margin: 50px 0 28px;

      & > * + * {
        margin-left: 12px;
      }
    `,
  };
};
