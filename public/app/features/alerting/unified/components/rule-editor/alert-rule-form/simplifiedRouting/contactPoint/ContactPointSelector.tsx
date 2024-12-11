import { useCallback, useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { ActionMeta, Button, Drawer, Field, FieldValidationMessage, Stack, TextLink } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { ContactPointSelector as ContactPointSelectorDropdown } from 'app/features/alerting/unified/components/notification-policies/ContactPointSelector';
import { GrafanaReceiverForm } from 'app/features/alerting/unified/components/receivers/form/GrafanaReceiverForm';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';

import { ContactPointWithMetadata } from '../../../../contact-points/utils';

export interface ContactPointSelectorProps {
  alertManager: string;
  onSelectContactPoint: (contactPoint?: ContactPointWithMetadata) => void;
}

export function ContactPointSelector({ alertManager, onSelectContactPoint }: ContactPointSelectorProps) {
  const { control, watch, trigger, setError } = useFormContext<RuleFormValues>();
  const [showContactPointDrawer, setShowContactPointDrawer] = useState<boolean>();

  const contactPointInForm = watch(`contactPoints.${alertManager}.selectedContactPoint`);

  // Wrap in useCallback to avoid infinite render loop
  const handleError = useCallback(
    (err: Error) => {
      setError(`contactPoints.${alertManager}.selectedContactPoint`, {
        message: err.message,
      });
    },
    [alertManager, setError]
  );

  // if we have a contact point selected, check if it still exists in the event that someone has deleted it
  const validateContactPoint = useCallback(() => {
    if (contactPointInForm) {
      trigger(`contactPoints.${alertManager}.selectedContactPoint`, { shouldFocus: true });
    }
  }, [alertManager, contactPointInForm, trigger]);

  // validate the contact point and check if it still exists when mounting the component
  useEffect(() => {
    validateContactPoint();
  }, [validateContactPoint]);

  return (
    <Stack direction="column">
      <Stack direction="row" alignItems="center">
        <Field label="Contact point" data-testid="contact-point-picker">
          <Controller
            render={({ field: { onChange }, fieldState: { error } }) => (
              <>
                <Stack>
                  <ContactPointSelectorDropdown
                    selectProps={{
                      onChange: (value: SelectableValue<ContactPointWithMetadata>, _: ActionMeta) => {
                        onChange(value?.value?.name);
                        onSelectContactPoint(value?.value);
                      },
                      width: 50,
                    }}
                    showRefreshButton
                    selectedContactPointName={contactPointInForm}
                    onError={handleError}
                  />
                  <Button
                    onClick={() => {
                      setShowContactPointDrawer(true);
                    }}
                    type="button"
                    icon="plus"
                    fill="outline"
                    variant="secondary"
                  >
                    <Trans i18nKey="alerting.contact-points.create">Create contact point</Trans>
                  </Button>
                  <LinkToContactPoints />
                </Stack>

                {/* Error can come from the required validation we have in here, or from the manual setError we do in the parent component.
                The only way I found to check the custom error is to check if the field has a value and if it's not in the options. */}

                {error && <FieldValidationMessage>{error?.message}</FieldValidationMessage>}
              </>
            )}
            rules={{
              required: {
                value: true,
                message: 'Contact point is required.',
              },
            }}
            control={control}
            name={`contactPoints.${alertManager}.selectedContactPoint`}
          />
        </Field>
      </Stack>
      {showContactPointDrawer && (
        <Drawer onClose={() => setShowContactPointDrawer(false)}>
          <GrafanaReceiverForm
            onCreate={() => {
              setShowContactPointDrawer(false);
            }}
          />
        </Drawer>
      )}
    </Stack>
  );
}
function LinkToContactPoints() {
  const hrefToContactPoints = '/alerting/notifications';
  return (
    <TextLink external href={createRelativeUrl(hrefToContactPoints)}>
      <Trans i18nKey="alerting.contact-points.view-all">View all contact points</Trans>
    </TextLink>
  );
}
