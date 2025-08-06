import { QueryStatus } from '@reduxjs/toolkit/query';
import { isEmpty } from 'lodash';
import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { ContactPointSelector as GrafanaManagedContactPointSelector, alertingAPI } from '@grafana/alerting/unstable';
import { Trans, t } from '@grafana/i18n';
import { Field, FieldValidationMessage, IconButton, Stack, TextLink } from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';
import { dispatch } from 'app/store/store';

export interface ContactPointSelectorProps {
  alertManager: string;
}

export function ContactPointSelector({ alertManager }: ContactPointSelectorProps) {
  const { control, watch, trigger } = useFormContext<RuleFormValues>();

  const selectedContactPointField = `contactPoints.${alertManager}.selectedContactPoint` as const;
  const contactPointInForm = watch(selectedContactPointField);

  // check if the contact point still exists, we'll use listReceiver to check if the contact point exists because getReceiver doesn't work with
  // contact point titles but with UUIDs (which is not what we store on the alert rule definition)
  const { currentData, status } = alertingAPI.endpoints.listReceiver.useQuery(
    {
      fieldSelector: `spec.title=${contactPointInForm}`,
    },
    { skip: Boolean(contactPointInForm) === false }
  );

  const contactPointNotFound = contactPointInForm && status === QueryStatus.fulfilled && isEmpty(currentData?.items);

  // validate the contact point and check if it still exists when we've gotten a response from the API
  useEffect(() => {
    if (contactPointInForm && status === QueryStatus.fulfilled) {
      trigger(selectedContactPointField, { shouldFocus: true });
    }
  }, [contactPointInForm, selectedContactPointField, status, trigger]);

  return (
    <Stack direction="row" alignItems="center">
      <Field
        label={t('alerting.contact-point-selector.contact-point-picker-label-contact-point', 'Contact point')}
        data-testid="contact-point-picker"
      >
        <Controller
          name={selectedContactPointField}
          render={({ field: { onChange }, fieldState: { error } }) => (
            <>
              <Stack>
                <GrafanaManagedContactPointSelector
                  isClearable={false}
                  onChange={(contactPoint) => onChange(contactPoint.spec.title)}
                  width={50}
                  value={contactPointInForm}
                />
                <IconButton
                  tooltip={t(
                    'alerting.contact-point-selector.aria-label-refresh-list',
                    'Refresh list of contact points'
                  )}
                  name="sync"
                  aria-label={t(
                    'alerting.contact-point-selector.aria-label-refresh-list',
                    'Refresh list of contact points'
                  )}
                  onClick={() => {
                    dispatch(alertingAPI.util.invalidateTags([{ type: 'Receiver' }]));
                  }}
                />
                <LinkToContactPoints />
              </Stack>

              {/* Error can come from the required validation we have in here, or from the manual setError we do in the parent component.
              The only way I found to check the custom error is to check if the field has a value and if it's not in the options. */}

              {error && <FieldValidationMessage>{error?.message}</FieldValidationMessage>}
            </>
          )}
          rules={{
            validate: () => {
              if (contactPointNotFound) {
                return t(
                  'alerting.contactPoints.validation.notFound',
                  `Contact point "{{contactPoint}}" could not be found`,
                  {
                    contactPoint: contactPointInForm,
                  }
                );
              }
              return true;
            },
            required: {
              value: true,
              message: t(
                'alerting.contact-point-selector.message.contact-point-is-required',
                'Contact point is required.'
              ),
            },
          }}
          control={control}
        />
      </Field>
    </Stack>
  );
}
function LinkToContactPoints() {
  const hrefToContactPoints = '/alerting/notifications';
  return (
    <TextLink
      external
      href={createRelativeUrl(hrefToContactPoints)}
      aria-label={t(
        'alerting.link-to-contact-points.aria-label-view-or-create-contact-points',
        'View or create contact points'
      )}
    >
      <Trans i18nKey="alerting.link-to-contact-points.view-or-create-contact-points">
        View or create contact points
      </Trans>
    </TextLink>
  );
}
