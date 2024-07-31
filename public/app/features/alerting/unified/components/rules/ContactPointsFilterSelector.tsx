import { css, cx, keyframes } from '@emotion/css';
import * as React from 'react';
import { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { ActionMeta, IconButton, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export interface ContactPointsFilterSelectorProps {
  options: Array<{
    label: string;
    value: string;
    description: React.JSX.Element;
  }>;
  selectedContactPoint: string | undefined;
  onSelectContactPoint: (contactPoint: string) => void;
  refetchReceivers: () => Promise<unknown>;
  isLoading: boolean;
}

const MAX_CONTACT_POINTS_RENDERED = 500;

export function ContactPointsFilterSelector({
  options,
  selectedContactPoint,
  onSelectContactPoint,
  refetchReceivers,
  isLoading,
}: ContactPointsFilterSelectorProps) {
  const styles = useStyles2(getStyles);

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
    <Stack direction="column" gap={0}>
      <Text variant="bodySmall">
        <Trans i18nKey="alerting.contactPointFilter.label">Contact point</Trans>
      </Text>
      <div className={styles.contactPointsSelector}>
        <Select<string>
          virtualized={options.length > MAX_CONTACT_POINTS_RENDERED}
          aria-label="Contact point"
          value={selectedContactPoint ?? null}
          isClearable
          isLoading={isLoading}
          loadingMessage="Loading..."
          onChange={(value: SelectableValue<string>, _: ActionMeta) => {
            onSelectContactPoint(value?.value ?? '');
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
        </div>
      </div>
    </Stack>
  );
}

const rotation = keyframes({
  from: {
    transform: 'rotate(720deg)',
  },
  to: {
    transform: 'rotate(0deg)',
  },
});

const getStyles = (theme: GrafanaTheme2) => ({
  contactPointsSelector: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: '2px',
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
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${rotation} 2s infinite linear`,
    },
    [theme.transitions.handleMotion('reduce')]: {
      animation: `${rotation} 6s infinite linear`,
    },
  }),
});
