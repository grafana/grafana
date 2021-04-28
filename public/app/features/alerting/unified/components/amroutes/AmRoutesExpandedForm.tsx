import React, { FC, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
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

export interface AmRoutesExpandedFormProps {
  onCancel: () => void;
  onSave: (data: FormAmRoute) => void;
  receivers: AmRouteReceiver[];
  routes: FormAmRoute;
}

export const AmRoutesExpandedForm: FC<AmRoutesExpandedFormProps> = ({ onCancel, onSave, receivers, routes }) => {
  const styles = useStyles(getStyles);
  const [overrideGrouping, setOverrideGrouping] = useState(routes.groupBy.length > 0);
  const [overrideTimings, setOverrideTimings] = useState(
    !!routes.groupWaitValue || !!routes.groupIntervalValue || !!routes.repeatIntervalValue
  );
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues(routes.groupBy));

  return (
    <Form defaultValues={routes} onSubmit={onSave}>
      {({ control, getValues, register }) => (
        <>
          <div>Matchers</div>
          <FieldArray name="matchers" control={control}>
            {({ fields, append }) => (
              <>
                {fields.map((field, index) => {
                  const localPath = `matchers[${index}]`;

                  return (
                    <HorizontalGroup key={field.id}>
                      <Field label="Label">
                        <Input
                          ref={register({ required: true })}
                          name={`${localPath}.label`}
                          defaultValue={field.label}
                        />
                      </Field>
                      <Field label="Value">
                        <Input
                          ref={register({ required: true })}
                          name={`${localPath}.value`}
                          defaultValue={field.value}
                        />
                      </Field>
                      <Field label="Regex">
                        <Checkbox ref={register()} name={`${localPath}.isRegex`} defaultChecked={field.isRegex} />
                      </Field>
                    </HorizontalGroup>
                  );
                })}
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
            <InputControl
              as={Select}
              control={control}
              name="receiver"
              onChange={mapSelectValueToString}
              options={receivers}
            />
          </Field>
          <Field label="Continue matching subsequent sibling nodes">
            <Switch ref={register()} name="continue" />
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
                allowCustomValue
                as={MultiSelect}
                control={control}
                name="groupBy"
                onChange={mapMultiSelectValueToStrings}
                onCreateOption={(opt: string) => {
                  setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);

                  control.setValue('groupBy', [...getValues().groupBy, opt]);
                }}
                options={groupByOptions}
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
              >
                <div>
                  <InputControl
                    as={Input}
                    control={control}
                    name="groupWaitValue"
                    rules={{
                      validate: optionalPositiveInteger,
                    }}
                  />
                  <InputControl
                    as={Select}
                    control={control}
                    name="groupWaitValueType"
                    onChange={mapSelectValueToString}
                    options={timeOptions}
                  />
                </div>
              </Field>
              <Field
                label="Group interval"
                description="The waiting time to send a batch of new alerts for that group after the first notification was sent."
              >
                <div>
                  <InputControl
                    as={Input}
                    control={control}
                    name="groupIntervalValue"
                    rules={{
                      validate: optionalPositiveInteger,
                    }}
                  />
                  <InputControl
                    as={Select}
                    control={control}
                    name="groupIntervalValueType"
                    onChange={mapSelectValueToString}
                    options={timeOptions}
                  />
                </div>
              </Field>
              <Field
                label="Repeat interval"
                description="The waiting time to resend an alert after they have successfully been sent."
              >
                <div>
                  <InputControl
                    as={Input}
                    control={control}
                    name="repeatIntervalValue"
                    rules={{
                      validate: optionalPositiveInteger,
                    }}
                  />
                  <InputControl
                    as={Select}
                    control={control}
                    menuPlacement="top"
                    name="repeatIntervalValueType"
                    onChange={mapSelectValueToString}
                    options={timeOptions}
                  />
                </div>
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

const getStyles = (_theme: GrafanaTheme) => {
  return {
    addMatcherBtn: css`
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
