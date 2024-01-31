import { css, cx } from '@emotion/css';
import { BaseQueryFn, QueryDefinition } from '@reduxjs/toolkit/dist/query';
import { QueryActionCreatorResult } from '@reduxjs/toolkit/dist/query/core/buildInitiate';
import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';
import {
  ActionMeta,
  Field,
  FieldValidationMessage,
  Icon,
  IconButton,
  InputControl,
  Select,
  Stack,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { createUrl } from 'app/features/alerting/unified/utils/url';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { ContactPointReceiverSummary } from '../../../../contact-points/ContactPoints';
import { ContactPointWithMetadata } from '../../../../contact-points/utils';

export interface ContactPointSelectorProps {
  alertManager: string;
  contactPoints: ContactPointWithMetadata[];
  onSelectContactPoint: (contactPoint?: ContactPointWithMetadata) => void;
  refetchReceivers: () => QueryActionCreatorResult<
    QueryDefinition<
      string,
      BaseQueryFn<BackendSrvRequest>,
      'AlertmanagerChoice' | 'AlertmanagerConfiguration' | 'OnCallIntegrations' | 'OrgMigrationState',
      AlertManagerCortexConfig,
      'alertingApi'
    >
  >;
}
export function ContactPointSelector({
  alertManager,
  contactPoints,
  onSelectContactPoint,
  refetchReceivers,
}: ContactPointSelectorProps) {
  const styles = useStyles2(getStyles);
  const { control, watch } = useFormContext<RuleFormValues>();

  const options = contactPoints.map((receiver) => {
    const integrations = receiver?.grafana_managed_receiver_configs;
    const description = <ContactPointReceiverSummary receivers={integrations ?? []} />;

    return { label: receiver.name, value: receiver, description };
  });

  const contactPointInForm = watch(`contactPoints.${alertManager}.selectedContactPoint`);

  const selectedContactPointWithMetadata = options.find((option) => option.value.name === contactPointInForm)?.value;
  const selectedContactPointSelectableValue = selectedContactPointWithMetadata
    ? { value: selectedContactPointWithMetadata, label: selectedContactPointWithMetadata.name }
    : undefined;

  // We need to provide a fake loading state for the contact points, because it might be that the response is so fast that the loading spinner is not shown,
  // and the user might think that the contact points are not fetched.
  // We will show the loading spinner for 1 second, and if the fetching takes more than 1 second, we will show the loading spinner until the fetching is done.

  const LOADING_SPINNER_DURATION = 1000;

  const [loadingContactPoints, setLoadingContactPoints] = useState(false);
  // we need to keep track if the fetching takes more than 1 second, so we can show the loading spinner until the fetching is done
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const onClickRefresh = () => {
    setLoadingContactPoints(true);
    Promise.all([refetchReceivers(), sleep(LOADING_SPINNER_DURATION)]).finally(() => {
      setLoadingContactPoints(false);
    });
  };

  return (
    <Stack direction="column">
      <Stack direction="row" alignItems="center">
        <Field label="Contact point">
          <InputControl
            render={({ field: { onChange, ref, ...field }, fieldState: { error } }) => (
              <>
                <div className={styles.contactPointsSelector}>
                  <Select
                    {...field}
                    defaultValue={selectedContactPointSelectableValue}
                    aria-label="Contact point"
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
                    {!selectedContactPointWithMetadata && Boolean(contactPointInForm) && (
                      <Stack direction="row" gap={1} alignItems="center">
                        <Icon name="exclamation-triangle" className={styles.warn} />
                        <div> {`Contact point ${contactPointInForm} does not exist.`} </div>
                      </Stack>
                    )}
                  </div>
                </div>
                {error && <FieldValidationMessage>{error.message}</FieldValidationMessage>}
              </>
            )}
            rules={{
              required: { value: true, message: 'Contact point is required.' },
              validate: {
                contactPointExists: (value: string) => {
                  if (options.some((option) => option.value.name === value)) {
                    return true;
                  }
                  return 'Contact point does not exist.';
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
