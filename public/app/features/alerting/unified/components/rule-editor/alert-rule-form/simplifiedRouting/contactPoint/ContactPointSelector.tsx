import { css, cx, keyframes } from '@emotion/css';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useCallback, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useFormContext, Controller } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { ActionMeta, Field, FieldValidationMessage, LoadingPlaceholder, Stack, TextLink } from '@grafana/ui';
import { ContactPointReceiverSummary } from 'app/features/alerting/unified/components/contact-points/ContactPoint';
import { useGetContactPoints } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { ContactPointSelector as ContactPointSelectorDropdown } from 'app/features/alerting/unified/components/notification-policies/ContactPointSelector';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';

import { ContactPointWithMetadata } from '../../../../contact-points/utils';

export interface ContactPointSelectorProps {
  alertManager: string;
  onSelectContactPoint: (contactPoint?: ContactPointWithMetadata) => void;
}

export function ContactPointSelector({ alertManager, onSelectContactPoint }: ContactPointSelectorProps) {
  const { isLoading, contactPoints = [] } = useGetContactPoints();
  const { control, watch, trigger } = useFormContext<RuleFormValues>();

  const contactPointInForm = watch(`contactPoints.${alertManager}.selectedContactPoint`);

  const options = contactPoints.map((receiver) => {
    const integrations = receiver?.grafana_managed_receiver_configs;
    const component = () => <ContactPointReceiverSummary receivers={integrations ?? []} />;

    return { label: receiver.name, value: receiver, component };
  });

  const selectedContactPointWithMetadata = contactPoints.find((option) => option.name === contactPointInForm);
  const selectedContactPointSelectableValue: SelectableValue<ContactPointWithMetadata> =
    selectedContactPointWithMetadata
      ? { value: selectedContactPointWithMetadata, label: selectedContactPointWithMetadata.name }
      : { value: undefined, label: '' };

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

  if (isLoading) {
    return <LoadingPlaceholder text="Loading..." />;
  }
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
                      'aria-label': 'Contact point',
                      defaultValue: selectedContactPointSelectableValue,
                      onChange: (value: SelectableValue<ContactPointWithMetadata>, _: ActionMeta) => {
                        onChange(value?.value?.name);
                        onSelectContactPoint(value?.value);
                      },
                      width: 50,
                    }}
                    showRefreshButton
                  />
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
              validate: {
                contactPointExists: (value: string) => {
                  if (options.some((option) => option.value.name === value)) {
                    return true;
                  }
                  return `Contact point ${contactPointInForm} does not exist.`;
                },
              },
            }}
            control={control}
            name={`contactPoints.${alertManager}.selectedContactPoint`}
          />
        </Field>
      </Stack>
    </Stack>
  );
}
function LinkToContactPoints() {
  const hrefToContactPoints = '/alerting/notifications';
  return (
    <TextLink external href={createRelativeUrl(hrefToContactPoints)} aria-label="View or create contact points">
      View or create contact points
    </TextLink>
  );
}
