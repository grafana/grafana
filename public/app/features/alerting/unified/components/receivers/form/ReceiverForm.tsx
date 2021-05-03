import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Field, Input, LinkButton, useStyles2 } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { NotifierDTO } from 'app/types';
import React, { useCallback } from 'react';
import { useForm, FormProvider, FieldErrors, Validate, useFieldArray } from 'react-hook-form';
import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
import { ChannelValues, CommonSettingsComponentType, ReceiverFormValues } from '../../../types/receiver-form';
import { makeAMLink } from '../../../utils/misc';
import { ChannelSubForm } from './ChannelSubForm';

interface Props<R extends ChannelValues> {
  notifiers: NotifierDTO[];
  defaultItem: R;
  alertManagerSourceName: string;
  onSubmit: (values: ReceiverFormValues<R>) => void;
  takenReceiverNames: string[]; // will validate that user entered receiver name is not one of these
  commonSettingsComponent: CommonSettingsComponentType;
  initialValues?: ReceiverFormValues<R>;
}

export function ReceiverForm<R extends ChannelValues>({
  initialValues,
  defaultItem,
  notifiers,
  alertManagerSourceName,
  onSubmit,
  takenReceiverNames,
  commonSettingsComponent,
}: Props<ChannelValues>): JSX.Element {
  const styles = useStyles2(getStyles);

  const defaultValues = initialValues || {
    name: '',
    items: [
      {
        ...defaultItem,
        __id: String(Math.random()),
      } as any,
    ],
  };

  const formAPI = useForm<ReceiverFormValues<R>>({
    defaultValues,
  });

  useCleanup((state) => state.unifiedAlerting.saveAMConfig);

  const { loading, error } = useUnifiedAlertingSelector((state) => state.saveAMConfig);

  const {
    handleSubmit,
    register,
    formState: { errors },
    getValues,
    control,
  } = formAPI;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items' as any, // bug in types
  });

  const validateNameIsAvailable: Validate<string> = useCallback(
    (name: string) =>
      takenReceiverNames.map((name) => name.trim().toLowerCase()).includes(name.trim().toLowerCase())
        ? 'Another receiver with this name already exists.'
        : true,
    [takenReceiverNames]
  );

  return (
    <FormProvider {...formAPI}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <h4 className={styles.heading}>{initialValues ? 'Update contact point' : 'Create contact point'}</h4>
        {error && (
          <Alert severity="error" title="Error saving template">
            {error.message || (error as any)?.data?.message || String(error)}
          </Alert>
        )}
        <Field label="Name" invalid={!!errors.name} error={errors.name && errors.name.message}>
          <Input
            {...register('name', {
              required: 'Name is required',
              validate: { nameIsAvailable: validateNameIsAvailable },
            })}
            width={39}
          />
        </Field>
        {fields.map((field: R & { id: string }, index) => {
          const initialItem = initialValues?.items.find(({ __id }) => __id === field.__id);
          return (
            <ChannelSubForm<R>
              defaultValues={field}
              key={field.id}
              onDuplicate={() => {
                const currentValues: R = getValues().items[index];
                append({ ...currentValues, __id: String(Math.random()) });
              }}
              onDelete={() => remove(index)}
              pathPrefix={`items.${index}.`}
              notifiers={notifiers}
              secureFields={initialItem?.secureFields}
              errors={errors?.items?.[index] as FieldErrors<R>}
              commonSettingsComponent={commonSettingsComponent}
            />
          );
        })}
        <Button type="button" icon="plus" onClick={() => append({ ...defaultItem, __id: String(Math.random()) } as R)}>
          New contact point type
        </Button>
        <div className={styles.buttons}>
          {loading && (
            <Button disabled={true} icon="fa fa-spinner" variant="primary">
              Saving...
            </Button>
          )}
          {!loading && <Button type="submit">Save contact point</Button>}
          <LinkButton
            disabled={loading}
            variant="secondary"
            href={makeAMLink('/alerting/notifications', alertManagerSourceName)}
          >
            Cancel
          </LinkButton>
        </div>
      </form>
    </FormProvider>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css`
    margin: ${theme.spacing(4, 0)};
  `,
  buttons: css`
    margin-top: ${theme.spacing(4)};

    & > * + * {
      margin-left: ${theme.spacing(1)};
    }
  `,
});
