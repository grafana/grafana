import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import {
  ContactPointSelector as GrafanaManagedContactPointSelector,
  useResolvedContactPoint,
} from '@grafana/alerting/unstable';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Field, FieldValidationMessage, Stack, TextLink } from '@grafana/ui';
import { type RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';

export interface ContactPointSelectorProps {
  alertManager: string;
}

export function ContactPointSelector({ alertManager }: ContactPointSelectorProps) {
  const { control, watch, trigger } = useFormContext<RuleFormValues>();

  const selectedContactPointField = `contactPoints.${alertManager}.selectedContactPoint` as const;
  const contactPointInForm = watch(selectedContactPointField);

  const { status, selectedContactPointId } = useResolvedContactPoint(contactPointInForm);

  const hasResolved = status === 'found' || status === 'notFound';

  // validate reads the resolved status, so it has to re-run once the list answers
  useEffect(() => {
    if (hasResolved) {
      trigger(selectedContactPointField, { shouldFocus: true });
    }
  }, [contactPointInForm, hasResolved, selectedContactPointField, trigger]);

  return (
    <Stack direction="row" alignItems="center">
      <Field
        noMargin
        label={t('alerting.contact-point-selector.contact-point-picker-label-contact-point', 'Contact point')}
        data-testid={selectors.components.AlertRules.contactPointPicker}
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
                  value={selectedContactPointId ?? contactPointInForm}
                  data-testid={selectors.components.AlertRules.contactPointInput}
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
              if (status === 'notFound') {
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
      data-testid={selectors.components.AlertRules.viewContactPointsLink}
    >
      <Trans i18nKey="alerting.link-to-contact-points.view-or-create-contact-points">
        View or create contact points
      </Trans>
    </TextLink>
  );
}
