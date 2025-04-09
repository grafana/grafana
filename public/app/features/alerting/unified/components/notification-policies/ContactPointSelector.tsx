import { css, cx, keyframes } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Alert, IconButton, Select, SelectCommonProps, Stack, Text, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { ContactPointReceiverSummary } from 'app/features/alerting/unified/components/contact-points/ContactPoint';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';

import { useContactPointsWithStatus } from '../contact-points/useContactPoints';
import { ContactPointWithMetadata } from '../contact-points/utils';

const MAX_CONTACT_POINTS_RENDERED = 500;

// Mock sleep method, as fetching receivers is very fast and may seem like it hasn't occurred
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const LOADING_SPINNER_DURATION = 1000;

type ContactPointSelectorProps = {
  selectProps: SelectCommonProps<ContactPointWithMetadata>;
  showRefreshButton?: boolean;
  /** Name of a contact point to optionally find and set as the preset value on the dropdown */
  selectedContactPointName?: string | null;
  onError?: (error: Error) => void;
};

export const ContactPointSelector = ({
  selectProps,
  showRefreshButton,
  selectedContactPointName,
  onError = () => {},
}: ContactPointSelectorProps) => {
  const { selectedAlertmanager } = useAlertmanager();
  const { contactPoints, isLoading, error, refetch } = useContactPointsWithStatus({
    alertmanager: selectedAlertmanager!,
  });
  const [loaderSpinning, setLoaderSpinning] = useState(false);
  const styles = useStyles2(getStyles);

  const options: Array<SelectableValue<ContactPointWithMetadata>> = contactPoints.map((contactPoint) => {
    return {
      label: contactPoint.name,
      value: contactPoint,
      component: () => (
        <Text variant="bodySmall" color="secondary">
          <ContactPointReceiverSummary receivers={contactPoint.grafana_managed_receiver_configs} limit={2} />
        </Text>
      ),
    };
  });

  const matchedContactPoint: SelectableValue<ContactPointWithMetadata> | null = useMemo(() => {
    return options.find((option) => option.value?.name === selectedContactPointName) || null;
  }, [options, selectedContactPointName]);

  // force some minimum wait period for fetching contact points
  const onClickRefresh = () => {
    setLoaderSpinning(true);
    Promise.all([refetch(), sleep(LOADING_SPINNER_DURATION)]).finally(() => {
      setLoaderSpinning(false);
    });
  };

  useEffect(() => {
    // If the contact points are fetched successfully and the selected contact point is not in the list, show an error
    if (!isLoading && selectedContactPointName && !matchedContactPoint) {
      onError(new Error(`Contact point "${selectedContactPointName}" could not be found`));
    }
  }, [isLoading, matchedContactPoint, onError, selectedContactPointName]);

  // TODO error handling
  if (error) {
    return (
      <Alert
        title={t(
          'alerting.contact-point-selector.title-failed-to-fetch-contact-points',
          'Failed to fetch contact points'
        )}
        severity="error"
      />
    );
  }

  return (
    <Stack>
      <Select
        virtualized={options.length > MAX_CONTACT_POINTS_RENDERED}
        options={options}
        value={matchedContactPoint}
        {...selectProps}
        isLoading={isLoading}
        disabled={isLoading}
      />
      {showRefreshButton && (
        <IconButton
          name="sync"
          onClick={onClickRefresh}
          aria-label={t('alerting.contact-point-selector.aria-label-refresh-contact-points', 'Refresh contact points')}
          tooltip={t(
            'alerting.contact-point-selector.tooltip-refresh-contact-points-list',
            'Refresh contact points list'
          )}
          className={cx(styles.refreshButton, {
            [styles.loading]: loaderSpinning || isLoading,
          })}
        />
      )}
    </Stack>
  );
};

const rotation = keyframes({
  from: {
    transform: 'rotate(0deg)',
  },
  to: {
    transform: 'rotate(720deg)',
  },
});

const getStyles = (theme: GrafanaTheme2) => ({
  refreshButton: css({
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    borderRadius: theme.shape.radius.circle,
    overflow: 'hidden',
  }),
  loading: css({
    pointerEvents: 'none',
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${rotation} 2s infinite linear`,
    },
    [theme.transitions.handleMotion('reduce')]: {
      animation: `${rotation} 6s infinite linear`,
    },
  }),
});
