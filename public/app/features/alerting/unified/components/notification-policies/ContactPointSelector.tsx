import { css, cx, keyframes } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Select, SelectCommonProps, Text, Stack, Alert, IconButton, useStyles2, LoadingPlaceholder } from '@grafana/ui';

import { RECEIVER_META_KEY, RECEIVER_PLUGIN_META_KEY, useGetContactPoints } from '../contact-points/useContactPoints';
import { ContactPointWithMetadata, ReceiverConfigWithMetadata } from '../contact-points/utils';

const MAX_CONTACT_POINTS_RENDERED = 500;

// Mock sleep method, as fetching receivers is very fast and may seem like it hasn't occurred
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const LOADING_SPINNER_DURATION = 1000;

export const ContactPointSelector = ({
  selectProps,
  showRefreshButton,
  selectedContactPointName,
}: {
  selectProps: SelectCommonProps<ContactPointWithMetadata>;
  showRefreshButton?: boolean;
  /** Name of a contact point to optionally find and set as the preset value on the dropdown */
  selectedContactPointName?: string;
}) => {
  const { contactPoints, isLoading, error, refetch } = useGetContactPoints();
  const [loaderSpinning, setLoaderSpinning] = useState(false);
  const styles = useStyles2(getStyles);

  const options: Array<SelectableValue<ContactPointWithMetadata>> = contactPoints.map((contactPoint) => {
    return {
      label: contactPoint.name,
      value: contactPoint,
      component: () => <ReceiversSummary receivers={contactPoint.grafana_managed_receiver_configs} />,
    };
  });

  const matchedContactPoint: SelectableValue<ContactPointWithMetadata> = useMemo(() => {
    return options.find((option) => option.value?.name === selectedContactPointName) || { value: undefined, label: '' };
  }, [options, selectedContactPointName]);

  // force some minimum wait period for fetching contact points
  const onClickRefresh = () => {
    setLoaderSpinning(true);
    Promise.all([refetch(), sleep(LOADING_SPINNER_DURATION)]).finally(() => {
      setLoaderSpinning(false);
    });
  };

  // TODO error handling
  if (error) {
    return <Alert title="Failed to fetch contact points" severity="error" />;
  }
  if (isLoading) {
    return <LoadingPlaceholder text="Loading..." />;
  }

  return (
    <Stack>
      <Select
        virtualized={options.length > MAX_CONTACT_POINTS_RENDERED}
        options={options}
        defaultValue={matchedContactPoint}
        {...selectProps}
      />
      {showRefreshButton && (
        <IconButton
          name="sync"
          onClick={onClickRefresh}
          aria-label="Refresh contact points"
          tooltip="Refresh contact points list"
          className={cx(styles.refreshButton, {
            [styles.loading]: loaderSpinning || isLoading,
          })}
        />
      )}
    </Stack>
  );
};

interface ReceiversProps {
  receivers: ReceiverConfigWithMetadata[];
}

const ReceiversSummary = ({ receivers }: ReceiversProps) => {
  return (
    <Stack direction="row">
      {receivers.map((receiver, index) => (
        <Stack key={receiver.uid ?? index} direction="row" gap={0.5}>
          {receiver[RECEIVER_PLUGIN_META_KEY]?.icon && (
            <img
              width="16px"
              src={receiver[RECEIVER_PLUGIN_META_KEY]?.icon}
              alt={receiver[RECEIVER_PLUGIN_META_KEY]?.title}
            />
          )}
          <Text key={index} variant="bodySmall" color="secondary">
            {receiver[RECEIVER_META_KEY].name ?? receiver[RECEIVER_PLUGIN_META_KEY]?.title ?? receiver.type}
          </Text>
        </Stack>
      ))}
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
