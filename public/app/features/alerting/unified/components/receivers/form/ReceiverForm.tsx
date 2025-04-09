import { css } from '@emotion/css';
import * as React from 'react';
import { FieldErrors, FormProvider, SubmitErrorHandler, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { Alert, Button, Field, Input, LinkButton, Stack, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { Trans, t } from 'app/core/internationalization';
import { useValidateContactPoint } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { ManagePermissions } from 'app/features/alerting/unified/components/permissions/ManagePermissions';

import { getMessageFromError } from '../../../../../../core/utils/errors';
import { logError } from '../../../Analytics';
import { isOnCallFetchError } from '../../../api/onCallApi';
import { useControlledFieldArray } from '../../../hooks/useControlledFieldArray';
import { ChannelValues, CommonSettingsComponentType, ReceiverFormValues } from '../../../types/receiver-form';
import { makeAMLink } from '../../../utils/misc';
import { initialAsyncRequestState } from '../../../utils/redux';

import { ChannelSubForm } from './ChannelSubForm';
import { DeletedSubForm } from './fields/DeletedSubform';
import { Notifier } from './notifiers';
import { normalizeFormValues } from './util';

interface Props<R extends ChannelValues> {
  notifiers: Notifier[];
  defaultItem: R;
  alertManagerSourceName: string;
  onTestChannel?: (channel: R) => void;
  onSubmit: (values: ReceiverFormValues<R>) => Promise<void>;
  commonSettingsComponent: CommonSettingsComponentType;
  initialValues?: ReceiverFormValues<R>;
  isEditable: boolean;
  isTestable?: boolean;
  customValidators?: Record<string, React.ComponentProps<typeof ChannelSubForm>['customValidators']>;
  /**
   * Should we show a warning that there is no default policy set,
   * and that contact point being created will be set as the default?
   */
  showDefaultRouteWarning?: boolean;
  contactPointId?: string;
  canManagePermissions?: boolean;
}

export function ReceiverForm<R extends ChannelValues>({
  initialValues,
  defaultItem,
  notifiers,
  alertManagerSourceName,
  onSubmit,
  onTestChannel,
  commonSettingsComponent,
  isEditable,
  isTestable,
  customValidators,
  showDefaultRouteWarning,
  contactPointId,
  canManagePermissions,
}: Props<R>) {
  const notifyApp = useAppNotification();
  const styles = useStyles2(getStyles);
  const validateContactPointName = useValidateContactPoint({ alertmanager: alertManagerSourceName });

  // normalize deprecated and new config values
  const normalizedConfig = normalizeFormValues(initialValues);

  const defaultValues = normalizedConfig ?? {
    name: '',
    items: [
      {
        ...defaultItem,
        __id: String(Math.random()),
      } as any,
    ],
  };

  const formAPI = useForm<ReceiverFormValues<R>>({
    // making a copy here beacuse react-hook-form will mutate these, and break if the object is frozen. for real.
    defaultValues: structuredClone(defaultValues),
  });

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));

  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
    getValues,
  } = formAPI;

  const { fields, append, remove } = useControlledFieldArray<R>({ name: 'items', formAPI, softDelete: true });

  const submitCallback = async (values: ReceiverFormValues<R>) => {
    values.items.forEach((item) => {
      if (item.secureFields) {
        // omit secure fields with boolean value as BE expects not touched fields to be omitted: https://github.com/grafana/grafana/pull/71307
        Object.keys(item.secureFields).forEach((key) => {
          if (item.secureFields[key] === true || item.secureFields[key] === false) {
            delete item.secureFields[key];
          }
        });
      }
    });

    try {
      await onSubmit({
        ...values,
        items: values.items.filter((item) => !item.__deleted),
      });
    } catch (e) {
      if (e instanceof Error || isFetchError(e)) {
        notifyApp.error('Failed to save the contact point', getErrorMessage(e));

        const error = new Error('Failed to save the contact point');
        error.cause = e;
        logError(error);
      }
      throw e;
    }
  };

  const onInvalid: SubmitErrorHandler<ReceiverFormValues<R>> = () => {
    notifyApp.error('There are errors in the form. Please correct them and try again!');
  };

  return (
    <FormProvider {...formAPI}>
      {showDefaultRouteWarning && (
        <Alert severity="warning" title={t('alerting.receiver-form.title-attention', 'Attention')}>
          Because there is no default policy configured yet, this contact point will automatically be set as default.
        </Alert>
      )}

      <form onSubmit={handleSubmit(submitCallback, onInvalid)} className={styles.wrapper}>
        <Stack justifyContent="space-between" alignItems="center">
          <h2 className={styles.heading}>
            {!isEditable ? 'Contact point' : initialValues ? 'Update contact point' : 'Create contact point'}
          </h2>
          {canManagePermissions && contactPointId && (
            <ManagePermissions
              resource="receivers"
              resourceId={contactPointId}
              resourceName={initialValues?.name}
              title={t(
                'alerting.receiver-form.title-manage-contact-point-permissions',
                'Manage contact point permissions'
              )}
            />
          )}
        </Stack>
        <Field
          label={t('alerting.receiver-form.label-name', 'Name')}
          invalid={!!errors.name}
          error={errors.name && errors.name.message}
          required
        >
          <Input
            readOnly={!isEditable}
            id="name"
            {...register('name', {
              required: 'Name is required',
              validate: async (value) => {
                const existingValue = initialValues?.name;
                return validateContactPointName(value, existingValue);
              },
            })}
            width={39}
            placeholder={t('alerting.receiver-form.name-placeholder-name', 'Name')}
          />
        </Field>
        {fields.map((field, index) => {
          const pathPrefix = `items.${index}.`;
          if (field.__deleted) {
            return <DeletedSubForm key={field.__id} pathPrefix={pathPrefix} />;
          }
          const initialItem = initialValues?.items.find(({ __id }) => __id === field.__id);
          return (
            <ChannelSubForm<R>
              defaultValues={field}
              initialValues={initialItem}
              key={field.__id}
              onDuplicate={() => {
                const currentValues: R = getValues().items[index];
                append({ ...currentValues, __id: String(Math.random()) });
              }}
              onTest={
                onTestChannel
                  ? () => {
                      const currentValues: R = getValues().items[index];
                      onTestChannel(currentValues);
                    }
                  : undefined
              }
              onDelete={() => remove(index)}
              pathPrefix={pathPrefix}
              notifiers={notifiers}
              secureFields={initialItem?.secureFields}
              errors={errors?.items?.[index] as FieldErrors<R>}
              commonSettingsComponent={commonSettingsComponent}
              isEditable={isEditable}
              isTestable={isTestable}
              customValidators={customValidators ? customValidators[field.type] : undefined}
            />
          );
        })}
        {isEditable && (
          <Button
            type="button"
            icon="plus"
            variant="secondary"
            onClick={() => append({ ...defaultItem, __id: String(Math.random()) })}
          >
            <Trans i18nKey="alerting.receiver-form.add-contact-point-integration">Add contact point integration</Trans>
          </Button>
        )}
        <div className={styles.buttons}>
          {isEditable && (
            <>
              {isSubmitting && (
                <Button disabled={true} icon="spinner" variant="primary">
                  <Trans i18nKey="alerting.receiver-form.saving">Saving...</Trans>
                </Button>
              )}
              {!isSubmitting && (
                <Button type="submit">
                  <Trans i18nKey="alerting.receiver-form.save-contact-point">Save contact point</Trans>
                </Button>
              )}
            </>
          )}
          <LinkButton
            disabled={isSubmitting}
            variant="secondary"
            data-testid="cancel-button"
            href={makeAMLink('/alerting/notifications', alertManagerSourceName)}
          >
            <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
          </LinkButton>
        </div>
      </form>
    </FormProvider>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css({
    margin: theme.spacing(2, 0, 3, 0),
  }),
  buttons: css({
    marginTop: theme.spacing(4),

    '& > * + *': {
      marginLeft: theme.spacing(1),
    },
  }),
  wrapper: css({
    maxWidth: `${theme.breakpoints.values.xl}px`,
  }),
});

function getErrorMessage(error: unknown) {
  if (isOnCallFetchError(error)) {
    return error.data.detail;
  }

  return getMessageFromError(error);
}
