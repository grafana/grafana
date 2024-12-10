import { css } from '@emotion/css';
import { ReactNode, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Badge,
  Button,
  Field,
  FieldValidationMessage,
  IconButton,
  Input,
  MultiSelect,
  Select,
  Stack,
  Switch,
  useStyles2,
} from '@grafana/ui';
import MuteTimingsSelector from 'app/features/alerting/unified/components/alertmanager-entities/MuteTimingsSelector';
import { ContactPointSelector } from 'app/features/alerting/unified/components/notification-policies/ContactPointSelector';
import { handleContactPointSelect } from 'app/features/alerting/unified/components/notification-policies/utils';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { MatcherOperator, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { FormAmRoute } from '../../types/amroutes';
import { matcherFieldOptions } from '../../utils/alertmanager';
import {
  amRouteToFormAmRoute,
  commonGroupByOptions,
  emptyArrayFieldMatcher,
  mapMultiSelectValueToStrings,
  promDurationValidator,
  repeatIntervalValidator,
  stringToSelectableValue,
  stringsToSelectableValues,
} from '../../utils/amroutes';

import { PromDurationInput } from './PromDurationInput';
import { getFormStyles } from './formStyles';
import { routeTimingsFields } from './routeTimingsFields';

export interface AmRoutesExpandedFormProps {
  route?: RouteWithID;
  onSubmit: (route: Partial<FormAmRoute>) => void;
  actionButtons: ReactNode;
  defaults?: Partial<FormAmRoute>;
}

export const AmRoutesExpandedForm = ({ actionButtons, route, onSubmit, defaults }: AmRoutesExpandedFormProps) => {
  const styles = useStyles2(getStyles);
  const formStyles = useStyles2(getFormStyles);
  const { selectedAlertmanager } = useAlertmanager();
  const [, canSeeMuteTimings] = useAlertmanagerAbility(AlertmanagerAction.ViewMuteTiming);
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues(route?.group_by));
  const emptyMatcher = [{ name: '', operator: MatcherOperator.equal, value: '' }];

  const formAmRoute = {
    ...amRouteToFormAmRoute(route),
    ...defaults,
  };

  const defaultValues: Omit<FormAmRoute, 'routes'> = {
    ...formAmRoute,
    // if we're adding a new route, show at least one empty matcher
    object_matchers: route ? formAmRoute.object_matchers : emptyMatcher,
  };

  const {
    handleSubmit,
    control,
    register,
    formState: { errors },
    setValue,
    watch,
    getValues,
  } = useForm<FormAmRoute>({
    defaultValues,
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'object_matchers',
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register('id')} />
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
              return (
                <Stack direction="row" key={field.id} alignItems="center">
                  <Field
                    label="Label"
                    invalid={!!errors.object_matchers?.[index]?.name}
                    error={errors.object_matchers?.[index]?.name?.message}
                  >
                    <Input
                      {...register(`object_matchers.${index}.name`, { required: 'Field is required' })}
                      defaultValue={field.name}
                      placeholder="label"
                      autoFocus
                    />
                  </Field>
                  <Field label={'Operator'}>
                    <Controller
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
                      {...register(`object_matchers.${index}.value`)}
                      defaultValue={field.value}
                      placeholder="value"
                    />
                  </Field>
                  <IconButton tooltip="Remove matcher" name={'trash-alt'} onClick={() => remove(index)}>
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

      <Field label="Contact point">
        <Controller
          render={({ field: { onChange, ref, value, ...field } }) => (
            <ContactPointSelector
              selectProps={{
                ...field,
                className: formStyles.input,
                onChange: (value) => handleContactPointSelect(value, onChange),
                isClearable: true,
              }}
              selectedContactPointName={value}
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
          description="Combine multiple alerts into a single notification by grouping them by the same label values. If empty, it is inherited from the parent policy."
        >
          <Controller
            rules={{
              validate: (value) => {
                if (!value || value.length === 0) {
                  return 'At least one group by option is required.';
                }
                return true;
              },
            }}
            render={({ field: { onChange, ref, ...field }, fieldState: { error } }) => (
              <>
                <MultiSelect
                  aria-label="Group by"
                  {...field}
                  invalid={Boolean(error)}
                  allowCustomValue
                  className={formStyles.input}
                  onCreateOption={(opt: string) => {
                    setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);
                    setValue('groupBy', [...(field.value || []), opt]);
                  }}
                  onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
                  options={[...commonGroupByOptions, ...groupByOptions]}
                />
                {error && <FieldValidationMessage>{error.message}</FieldValidationMessage>}
              </>
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
            label={routeTimingsFields.groupWait.label}
            description={routeTimingsFields.groupWait.description}
            invalid={!!errors.groupWaitValue}
            error={errors.groupWaitValue?.message}
          >
            <PromDurationInput
              {...register('groupWaitValue', { validate: promDurationValidator })}
              aria-label={routeTimingsFields.groupWait.ariaLabel}
              className={formStyles.promDurationInput}
            />
          </Field>
          <Field
            label={routeTimingsFields.groupInterval.label}
            description={routeTimingsFields.groupInterval.description}
            invalid={!!errors.groupIntervalValue}
            error={errors.groupIntervalValue?.message}
          >
            <PromDurationInput
              {...register('groupIntervalValue', { validate: promDurationValidator })}
              aria-label={routeTimingsFields.groupInterval.ariaLabel}
              className={formStyles.promDurationInput}
            />
          </Field>
          <Field
            label={routeTimingsFields.repeatInterval.label}
            description={routeTimingsFields.repeatInterval.description}
            invalid={!!errors.repeatIntervalValue}
            error={errors.repeatIntervalValue?.message}
          >
            <PromDurationInput
              {...register('repeatIntervalValue', {
                validate: (value = '') => {
                  const groupInterval = getValues('groupIntervalValue');
                  return repeatIntervalValidator(value, groupInterval);
                },
              })}
              aria-label={routeTimingsFields.repeatInterval.ariaLabel}
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
        <Controller
          render={({ field: { onChange, ref, ...field } }) => (
            <MuteTimingsSelector
              alertmanager={selectedAlertmanager!}
              selectProps={{
                ...field,
                disabled: !canSeeMuteTimings,
                onChange: (value) => onChange(mapMultiSelectValueToStrings(value)),
              }}
            />
          )}
          control={control}
          name="muteTimeIntervals"
        />
      </Field>
      {actionButtons}
    </form>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const commonSpacing = theme.spacing(3.5);

  return {
    addMatcherBtn: css({
      marginBottom: commonSpacing,
    }),
    matchersContainer: css({
      backgroundColor: theme.colors.background.secondary,
      padding: `${theme.spacing(1.5)} ${theme.spacing(2)}`,
      paddingBottom: 0,
      width: 'fit-content',
    }),
    matchersOperator: css({
      minWidth: '120px',
    }),
    noMatchersWarning: css({
      padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
      marginBottom: theme.spacing(1),
    }),
  };
};
