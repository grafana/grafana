import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { dateMath, GrafanaTheme2 } from '@grafana/data';
import { CollapsableSection, Icon, Link, LinkButton, useStyles2, Stack, Alert, LoadingPlaceholder } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { alertSilencesApi } from 'app/features/alerting/unified/api/alertSilencesApi';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { featureDiscoveryApi } from 'app/features/alerting/unified/api/featureDiscoveryApi';
import { SILENCES_POLL_INTERVAL_MS } from 'app/features/alerting/unified/utils/constants';
import { getDatasourceAPIUid } from 'app/features/alerting/unified/utils/datasource';
import { AlertmanagerAlert, Silence, SilenceState } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { parseMatchers } from '../../utils/alertmanager';
import { getSilenceFiltersFromUrlParams, makeAMLink, stringifyErrorLike } from '../../utils/misc';
import { Authorize } from '../Authorize';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';

import { Matchers } from './Matchers';
import { NoSilencesSplash } from './NoSilencesCTA';
import { SilenceDetails } from './SilenceDetails';
import { SilenceStateTag } from './SilenceStateTag';
import { SilencesFilter } from './SilencesFilter';

export interface SilenceTableItem extends Silence {
  silencedAlerts: AlertmanagerAlert[];
}

type SilenceTableColumnProps = DynamicTableColumnProps<SilenceTableItem>;
type SilenceTableItemProps = DynamicTableItemProps<SilenceTableItem>;
interface Props {
  alertManagerSourceName: string;
}

const API_QUERY_OPTIONS = { pollingInterval: SILENCES_POLL_INTERVAL_MS, refetchOnFocus: true };

const SilencesTable = ({ alertManagerSourceName }: Props) => {
  const { data: alertManagerAlerts = [], isLoading: amAlertsIsLoading } =
    alertmanagerApi.endpoints.getAlertmanagerAlerts.useQuery(
      { amSourceName: alertManagerSourceName, filter: { silenced: true, active: true, inhibited: true } },
      API_QUERY_OPTIONS
    );

  const {
    data: silences = [],
    isLoading,
    error,
  } = alertSilencesApi.endpoints.getSilences.useQuery(
    { datasourceUid: getDatasourceAPIUid(alertManagerSourceName) },
    API_QUERY_OPTIONS
  );

  const { currentData: amFeatures } = featureDiscoveryApi.useDiscoverAmFeaturesQuery(
    { amSourceName: alertManagerSourceName ?? '' },
    { skip: !alertManagerSourceName }
  );

  const mimirLazyInitError =
    stringifyErrorLike(error).includes('the Alertmanager is not configured') && amFeatures?.lazyConfigInit;

  const styles = useStyles2(getStyles);
  const [queryParams] = useQueryParams();
  const filteredSilencesNotExpired = useFilteredSilences(silences, false);
  const filteredSilencesExpired = useFilteredSilences(silences, true);

  const { silenceState: silenceStateInParams } = getSilenceFiltersFromUrlParams(queryParams);
  const showExpiredFromUrl = silenceStateInParams === SilenceState.Expired;

  const itemsNotExpired = useMemo((): SilenceTableItemProps[] => {
    const findSilencedAlerts = (id: string) => {
      return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
    };
    return filteredSilencesNotExpired.map((silence) => {
      const silencedAlerts = findSilencedAlerts(silence.id);
      return {
        id: silence.id,
        data: { ...silence, silencedAlerts },
      };
    });
  }, [filteredSilencesNotExpired, alertManagerAlerts]);

  const itemsExpired = useMemo((): SilenceTableItemProps[] => {
    const findSilencedAlerts = (id: string) => {
      return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
    };
    return filteredSilencesExpired.map((silence) => {
      const silencedAlerts = findSilencedAlerts(silence.id);
      return {
        id: silence.id,
        data: { ...silence, silencedAlerts },
      };
    });
  }, [filteredSilencesExpired, alertManagerAlerts]);

  if (isLoading || amAlertsIsLoading) {
    return <LoadingPlaceholder text="Loading silences..." />;
  }

  if (mimirLazyInitError) {
    return (
      <Alert title="The selected Alertmanager has no configuration" severity="warning">
        Create a new contact point to create a configuration using the default values or contact your administrator to
        set up the Alertmanager.
      </Alert>
    );
  }

  if (error) {
    const errMessage = stringifyErrorLike(error) || 'Unknown error.';
    return (
      <Alert severity="error" title="Error loading silences">
        {errMessage}
      </Alert>
    );
  }

  return (
    <div data-testid="silences-table">
      {!!silences.length && (
        <Stack direction="column">
          <SilencesFilter />
          <Authorize actions={[AlertmanagerAction.CreateSilence]}>
            <Stack justifyContent="end">
              <LinkButton href={makeAMLink('/alerting/silence/new', alertManagerSourceName)} icon="plus">
                Add Silence
              </LinkButton>
            </Stack>
          </Authorize>
          <SilenceList
            items={itemsNotExpired}
            alertManagerSourceName={alertManagerSourceName}
            dataTestId="not-expired-table"
          />
          {itemsExpired.length > 0 && (
            <CollapsableSection label={`Expired silences (${itemsExpired.length})`} isOpen={showExpiredFromUrl}>
              <div className={styles.callout}>
                <Icon className={styles.calloutIcon} name="info-circle" />
                <span>Expired silences are automatically deleted after 5 days.</span>
              </div>
              <SilenceList
                items={itemsExpired}
                alertManagerSourceName={alertManagerSourceName}
                dataTestId="expired-table"
              />
            </CollapsableSection>
          )}
        </Stack>
      )}
      {!silences.length && <NoSilencesSplash alertManagerSourceName={alertManagerSourceName} />}
    </div>
  );
};

function SilenceList({
  items,
  alertManagerSourceName,
  dataTestId,
}: {
  items: SilenceTableItemProps[];
  alertManagerSourceName: string;
  dataTestId: string;
}) {
  const columns = useColumns(alertManagerSourceName);
  if (!!items.length) {
    return (
      <DynamicTable
        pagination={{ itemsPerPage: 25 }}
        items={items}
        cols={columns}
        isExpandable
        dataTestId={dataTestId}
        renderExpandedContent={({ data }) => <SilenceDetails silence={data} />}
      />
    );
  } else {
    return <>No matching silences found</>;
  }
}

const useFilteredSilences = (silences: Silence[], expired = false) => {
  const [queryParams] = useQueryParams();
  return useMemo(() => {
    const { queryString } = getSilenceFiltersFromUrlParams(queryParams);
    const silenceIdsString = queryParams?.silenceIds;
    return silences.filter((silence) => {
      if (typeof silenceIdsString === 'string') {
        const idsIncluded = silenceIdsString.split(',').includes(silence.id);
        if (!idsIncluded) {
          return false;
        }
      }
      if (queryString) {
        const matchers = parseMatchers(queryString);
        const matchersMatch = matchers.every((matcher) =>
          silence.matchers?.some(
            ({ name, value, isEqual, isRegex }) =>
              matcher.name === name &&
              matcher.value === value &&
              matcher.isEqual === isEqual &&
              matcher.isRegex === isRegex
          )
        );
        if (!matchersMatch) {
          return false;
        }
      }
      if (expired) {
        return silence.status.state === SilenceState.Expired;
      } else {
        return silence.status.state !== SilenceState.Expired;
      }
    });
  }, [queryParams, silences, expired]);
};

const getStyles = (theme: GrafanaTheme2) => ({
  callout: css({
    backgroundColor: theme.colors.background.secondary,
    borderTop: `3px solid ${theme.colors.info.border}`,
    borderRadius: theme.shape.radius.default,
    height: '62px',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',

    '& > *': {
      marginLeft: theme.spacing(1),
    },
  }),
  calloutIcon: css({
    color: theme.colors.info.text,
  }),
});

function useColumns(alertManagerSourceName: string) {
  const [updateSupported, updateAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateSilence);
  const [expireSilence] = alertSilencesApi.endpoints.expireSilence.useMutation();

  return useMemo((): SilenceTableColumnProps[] => {
    const handleExpireSilenceClick = (silenceId: string) => {
      expireSilence({ datasourceUid: getDatasourceAPIUid(alertManagerSourceName), silenceId });
    };
    const columns: SilenceTableColumnProps[] = [
      {
        id: 'state',
        label: 'State',
        renderCell: function renderStateTag({ data: { status } }) {
          return <SilenceStateTag state={status.state} />;
        },
        size: 4,
      },
      {
        id: 'matchers',
        label: 'Matching labels',
        renderCell: function renderMatchers({ data: { matchers } }) {
          return <Matchers matchers={matchers || []} />;
        },
        size: 10,
      },
      {
        id: 'alerts',
        label: 'Alerts',
        renderCell: function renderSilencedAlerts({ data: { silencedAlerts } }) {
          return <span data-testid="alerts">{silencedAlerts.length}</span>;
        },
        size: 4,
      },
      {
        id: 'schedule',
        label: 'Schedule',
        renderCell: function renderSchedule({ data: { startsAt, endsAt } }) {
          const startsAtDate = dateMath.parse(startsAt);
          const endsAtDate = dateMath.parse(endsAt);
          const dateDisplayFormat = 'YYYY-MM-DD HH:mm';
          return (
            <>
              {' '}
              {startsAtDate?.format(dateDisplayFormat)} {'-'}
              {endsAtDate?.format(dateDisplayFormat)}
            </>
          );
        },
        size: 7,
      },
    ];
    if (updateSupported && updateAllowed) {
      columns.push({
        id: 'actions',
        label: 'Actions',
        renderCell: function renderActions({ data: silence }) {
          return (
            <Stack gap={0.5}>
              {silence.status.state === 'expired' ? (
                <Link href={makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName)}>
                  <ActionButton icon="sync">Recreate</ActionButton>
                </Link>
              ) : (
                <ActionButton icon="bell" onClick={() => handleExpireSilenceClick(silence.id)}>
                  Unsilence
                </ActionButton>
              )}
              {silence.status.state !== 'expired' && (
                <ActionIcon
                  to={makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName)}
                  icon="pen"
                  tooltip="Edit"
                />
              )}
            </Stack>
          );
        },
        size: 5,
      });
    }
    return columns;
  }, [alertManagerSourceName, expireSilence, updateAllowed, updateSupported]);
}
export default SilencesTable;
