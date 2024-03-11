import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  ActionMeta,
  Field,
  FieldValidationMessage,
  IconButton,
  InputControl,
  Select,
  Stack,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { createUrl } from 'app/features/alerting/unified/utils/url';

import { ContactPointWithMetadata } from '../../../../contact-points/utils';

export interface ContactPointSelectorProps {
  alertManager: string;
  options: Array<{
    label: string;
    value: ContactPointWithMetadata;
    description: React.JSX.Element;
  }>;
  onSelectContactPoint: (contactPoint?: ContactPointWithMetadata) => void;
  refetchReceivers: () => Promise<unknown>;
}

const MAX_CONTACT_POINTS_RENDERED = 500;

export function ContactPointSelector({
  alertManager,
  options,
  onSelectContactPoint,
  refetchReceivers,
}: ContactPointSelectorProps) {
  const styles = useStyles2(getStyles);
  const { control, watch, trigger } = useFormContext<RuleFormValues>();

  const contactPointInForm = watch(`contactPoints.${alertManager}.selectedContactPoint`);

  const selectedContactPointWithMetadata = options.find((option) => option.value.name === contactPointInForm)?.value;
  const selectedContactPointSelectableValue: SelectableValue<ContactPointWithMetadata> =
    selectedContactPointWithMetadata
      ? { value: selectedContactPointWithMetadata, label: selectedContactPointWithMetadata.name }
      : { value: undefined, label: '' };

  const LOADING_SPINNER_DURATION = 1000;

  const [loadingContactPoints, setLoadingContactPoints] = useState(false);
  // we need to keep track if the fetching takes more than 1 second, so we can show the loading spinner until the fetching is done
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // if we have a contact point selected, check if it still exists in the event that someone has deleted it
  const validateContactPoint = useCallback(() => {
    if (contactPointInForm) {
      trigger(`contactPoints.${alertManager}.selectedContactPoint`, { shouldFocus: true });
    }
  }, [alertManager, contactPointInForm, trigger]);

  const onClickRefresh = () => {
    setLoadingContactPoints(true);
    Promise.all([refetchReceivers(), sleep(LOADING_SPINNER_DURATION)]).finally(() => {
      setLoadingContactPoints(false);
      validateContactPoint();
    });
  };

  // validate the contact point and check if it still exists when mounting the component
  useEffect(() => {
    validateContactPoint();
  }, [validateContactPoint]);

  return (
    <Stack direction="column">
      <Stack direction="row" alignItems="center">
        <Field label="Contact point" data-testid="contact-point-picker">
          <InputControl
            render={({ field: { onChange, ref, ...field }, fieldState: { error } }) => (
              <>
                <div className={styles.contactPointsSelector}>
                  <Select<ContactPointWithMetadata>
                    virtualized={options.length > MAX_CONTACT_POINTS_RENDERED}
                    aria-label="Contact point"
                    defaultValue={selectedContactPointSelectableValue}
                    onChange={(value: SelectableValue<ContactPointWithMetadata>, _: ActionMeta) => {
                      onChange(value?.value?.name);
                      onSelectContactPoint(value?.value);
                    }}
                    // We are passing a JSX.Element into the "description" for options, which isn't how the TS typings are defined.
                    // The regular Select component will render it just fine, but we can't update the typings because SelectableValue
                    // is shared with other components where the "description" _has_ to be a string.
                    // I've tried unsuccessfully to separate the typings just I'm giving up :'(
                    // @ts-ignore
                    options={options}
                    width={50}
                  />
                  <div className={styles.contactPointsInfo}>
                    <IconButton
                      name="sync"
                      onClick={onClickRefresh}
                      aria-label="Refresh contact points"
                      tooltip="Refresh contact points list"
                      className={cx(styles.refreshButton, {
                        [styles.loading]: loadingContactPoints,
                      })}
                    />
                    <LinkToContactPoints />
                  </div>
                </div>

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
    <TextLink external href={createUrl(hrefToContactPoints)} aria-label="View or create contact points">
      View or create contact points
    </TextLink>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  contactPointsSelector: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  }),
  contactPointsInfo: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
  }),
  refreshButton: css({
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    borderRadius: theme.shape.radius.circle,
    overflow: 'hidden',
  }),
  loading: css({
    pointerEvents: 'none',
    animation: 'rotation 2s infinite linear',
    '@keyframes rotation': {
      from: {
        transform: 'rotate(720deg)',
      },
      to: {
        transform: 'rotate(0deg)',
      },
    },
  }),
  warn: css({
    color: theme.colors.warning.text,
  }),
});
