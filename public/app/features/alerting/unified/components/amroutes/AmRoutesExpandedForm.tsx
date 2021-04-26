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
import { Receiver } from 'app/plugins/datasource/alertmanager/types';
import { AmRouteFormValues } from '../../types/amroutes';
import { emptyMatcher, mapStringToSelectableValue, optionalPositiveInteger } from '../../utils/amroutes';
import { timeOptions } from '../../utils/time';
import { AmRoutesTable } from './AmRoutesTable';

export interface AmRoutesExpandedFormProps {
  onExitEditMode: () => void;
  routes: AmRouteFormValues;
  receivers: Array<SelectableValue<Receiver['name']>>;
}

export const AmRoutesExpandedForm: FC<AmRoutesExpandedFormProps> = ({ onExitEditMode, receivers, routes }) => {
  const styles = useStyles(getStyles);
  const [overrideGrouping, setOverrideGrouping] = useState(!!routes.groupBy && routes.groupBy.length > 0);
  const [overrideTimings, setOverrideTimings] = useState(
    !!routes.groupWaitValue || !!routes.groupIntervalValue || !!routes.repeatIntervalValue
  );
  const [groupByOptions, setGroupByOptions] = useState(routes.groupBy);

  return (
    <Form defaultValues={routes} onSubmit={(data) => console.log(data)} maxWidth="none">
      {({ control, getValues, register }) => (
        <>
          <div className={styles.container}>
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
                    onClick={() => append(emptyMatcher)}
                    variant="secondary"
                    type="button"
                  >
                    Add matcher
                  </Button>
                </>
              )}
            </FieldArray>
            <Field label="Contact point">
              <InputControl as={Select} control={control} name="receiver" options={receivers} />
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
                  onCreateOption={(opt: string) => {
                    const newOpt = mapStringToSelectableValue(opt);

                    setGroupByOptions((groupByOptions) => [...groupByOptions, newOpt]);

                    control.setValue('groupBy', [...getValues().groupBy, newOpt]);
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
                    <InputControl as={Select} control={control} name="groupWaitValueType" options={timeOptions} />
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
                    <InputControl as={Select} control={control} name="groupIntervalValueType" options={timeOptions} />
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
                      options={timeOptions}
                    />
                  </div>
                </Field>
              </>
            )}
          </div>
          <div className={styles.nestedPolicies}>Nested policies</div>
          <AmRoutesTable routes={routes.routes} receivers={receivers} />
          <div className={styles.buttonGroup}>
            <Button type="submit">Save policy</Button>
            <Button onClick={onExitEditMode} type="button" variant="secondary">
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
    container: css`
      max-width: 600px;
    `,
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
