import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, dateMath } from '@grafana/data';
import {
  Alert,
  CollapsableSection,
  Divider,
  Icon,
  Link,
  LinkButton,
  LoadingPlaceholder,
  Stack,
  useStyles2,
} from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { Trans, t } from 'app/core/internationalization';
import { alertSilencesApi } from 'app/features/alerting/unified/api/alertSilencesApi';
import { featureDiscoveryApi } from 'app/features/alerting/unified/api/featureDiscoveryApi';
import { MATCHER_ALERT_RULE_UID, SILENCES_POLL_INTERVAL_MS } from 'app/features/alerting/unified/utils/constants';
import { GRAFANA_RULES_SOURCE_NAME, getDatasourceAPIUid } from 'app/features/alerting/unified/utils/datasource';
import { AlertmanagerAlert, Silence, SilenceState } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { parsePromQLStyleMatcherLooseSafe } from '../../utils/matchers';
import { getSilenceFiltersFromUrlParams, makeAMLink, stringifyErrorLike } from '../../utils/misc';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { Authorize } from '../Authorize';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { GrafanaAlertmanagerDeliveryWarning } from '../GrafanaAlertmanagerDeliveryWarning';

import { Matchers } from './Matchers';
import { NoSilencesSplash } from './NoSilencesCTA';
import { SilenceDetails } from './SilenceDetails';
import { SilenceStateTag } from './SilenceStateTag';
import { SilencesFilter } from './SilencesFilter';

export interface SilenceTableItem extends Silence {
  silencedAlerts: AlertmanagerAlert[] | undefined;
}

type SilenceTableColumnProps = DynamicTableColumnProps<SilenceTableItem>;
type SilenceTableItemProps = DynamicTableItemProps<SilenceTableItem>;

const API_QUERY_OPTIONS = { pollingInterval: SILENCES_POLL_INTERVAL_MS, refetchOnFocus: true };

const SilencesTable = () => {
  const { selectedAlertmanager: alertManagerSourceName = '' } = useAlertmanager();
  const [previewAlertsSupported, previewAlertsAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.PreviewSilencedInstances
  );
  const canPreview = previewAlertsSupported && previewAlertsAllowed;

  const { data: alertManagerAlerts = [], isLoading: amAlertsIsLoading } =
    alertmanagerApi.endpoints.getAlertmanagerAlerts.useQuery(
      { amSourceName: alertManagerSourceName, filter: { silenced: true, active: true, inhibited: true } },
      { ...API_QUERY_OPTIONS, skip: !canPreview }
    );

  const {
    data: silences = [],
    isLoading,
    error,
  } = alertSilencesApi.endpoints.getSilences.useQuery(
    { datasourceUid: getDatasourceAPIUid(alertManagerSourceName), ruleMetadata: true, accessControl: true },
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
      const silencedAlerts = canPreview ? findSilencedAlerts(silence.id) : undefined;
      return {
        id: silence.id,
        data: { ...silence, silencedAlerts },
      };
    });
  }, [filteredSilencesNotExpired, alertManagerAlerts, canPreview]);

  const itemsExpired = useMemo((): SilenceTableItemProps[] => {
    const findSilencedAlerts = (id: string) => {
      return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
    };
    return filteredSilencesExpired.map((silence) => {
      const silencedAlerts = canPreview ? findSilencedAlerts(silence.id) : undefined;
      return {
        id: silence.id,
        data: { ...silence, silencedAlerts },
      };
    });
  }, [filteredSilencesExpired, alertManagerAlerts, canPreview]);

  if (isLoading || amAlertsIsLoading) {
    return <LoadingPlaceholder text={t('alerting.silences-table.text-loading-silences', 'Loading silences...')} />;
  }

  if (mimirLazyInitError) {
    return (
      <Alert
        title={t(
          'alerting.silences-table.title-the-selected-alertmanager-has-no-configuration',
          'The selected Alertmanager has no configuration'
        )}
        severity="warning"
      >
        <Trans i18nKey="silences.table.noConfig">
          Create a new contact point to create a configuration using the default values or contact your administrator to
          set up the Alertmanager.
        </Trans>
      </Alert>
    );
  }

  if (error) {
    const errMessage = stringifyErrorLike(error) || 'Unknown error.';
    return (
      <Alert
        severity="error"
        title={t('alerting.silences-table.title-error-loading-silences', 'Error loading silences')}
      >
        {errMessage}
      </Alert>
    );
  }

  return (
    <div data-testid="silences-table">
      <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={alertManagerSourceName} />
      {!!silences.length && (
        <Stack direction="column">
          <SilencesFilter />
          <Authorize actions={[AlertmanagerAction.CreateSilence]}>
            <Stack justifyContent="end">
              <LinkButton href={makeAMLink('/alerting/silence/new', alertManagerSourceName)} icon="plus">
                <Trans i18nKey="silences.table.add-silence-button">Add Silence</Trans>
              </LinkButton>
            </Stack>
          </Authorize>
          <SilenceList
            items={itemsNotExpired}
            alertManagerSourceName={alertManagerSourceName}
            dataTestId="not-expired-table"
          />
          {itemsExpired.length > 0 && (
            <CollapsableSection
              label={t('alerting.silences-table.label-section-expired', 'Expired silences ({{numExpired}})', {
                numExpired: itemsExpired.length,
              })}
              isOpen={showExpiredFromUrl}
            >
              <div className={styles.callout}>
                <Icon className={styles.calloutIcon} name="info-circle" />
                <span>
                  <Trans i18nKey="silences.table.expired-silences">
                    Expired silences are automatically deleted after 5 days.
                  </Trans>
                </span>
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
        renderExpandedContent={({ data }) => {
          return (
            <>
              <Divider />
              <SilenceDetails silence={data} />
            </>
          );
        }}
      />
    );
  } else {
    return <Trans i18nKey="silences.table.no-matching-silences">No matching silences found;</Trans>;
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
        const matchers = parsePromQLStyleMatcherLooseSafe(queryString);
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
  const isGrafanaFlavoredAlertmanager = alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME;

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
        size: 3,
      },
      {
        id: 'alert-rule',
        label: 'Alert rule targeted',
        renderCell: function renderAlertRuleLink({ data: { metadata } }) {
          return metadata?.rule_title ? (
            <Link
              href={`/alerting/grafana/${metadata?.rule_uid}/view?returnTo=${encodeURIComponent('/alerting/silences')}`}
            >
              {metadata.rule_title}
            </Link>
          ) : (
            'None'
          );
        },
        size: 8,
      },
      {
        id: 'matchers',
        label: 'Matching labels',
        renderCell: function renderMatchers({ data: { matchers } }) {
          const filteredMatchers = matchers?.filter((matcher) => matcher.name !== MATCHER_ALERT_RULE_UID) || [];
          return <Matchers matchers={filteredMatchers} />;
        },
        size: 7,
      },
      {
        id: 'alerts',
        label: 'Alerts silenced',
        renderCell: function renderSilencedAlerts({ data: { silencedAlerts } }) {
          return (
            <span data-testid="alerts">
              {Array.isArray(silencedAlerts)
                ? silencedAlerts.length
                : // eslint-disable-next-line @grafana/no-untranslated-strings
                  '-'}
            </span>
          );
        },
        size: 2,
      },
      {
        id: 'schedule',
        label: 'Schedule',
        renderCell: function renderSchedule({ data: { startsAt, endsAt } }) {
          const startsAtDate = dateMath.parse(startsAt);
          const endsAtDate = dateMath.parse(endsAt);
          const dateDisplayFormat = 'YYYY-MM-DD HH:mm';
          return `${startsAtDate?.format(dateDisplayFormat)} - ${endsAtDate?.format(dateDisplayFormat)}`;
        },
        size: 7,
      },
    ];
    if (updateSupported) {
      columns.push({
        id: 'actions',
        label: 'Actions',
        renderCell: function renderActions({ data: silence }) {
          const isExpired = silence.status.state === SilenceState.Expired;

          const canCreate = silence?.accessControl?.create;
          const canWrite = silence?.accessControl?.write;

          const canRecreate = isExpired && (isGrafanaFlavoredAlertmanager ? canCreate : updateAllowed);
          const canEdit = !isExpired && (isGrafanaFlavoredAlertmanager ? canWrite : updateAllowed);

          return (
            <Stack gap={0.5} wrap="wrap">
              {canRecreate && (
                <LinkButton
                  title={t('alerting.use-columns.title-recreate', 'Recreate')}
                  size="sm"
                  variant="secondary"
                  icon="sync"
                  href={makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName)}
                >
                  <Trans i18nKey="silences.table.recreate-button">Recreate</Trans>
                </LinkButton>
              )}
              {canEdit && (
                <>
                  <LinkButton
                    title={t('alerting.use-columns.title-unsilence', 'Unsilence')}
                    size="sm"
                    variant="secondary"
                    icon="bell"
                    onClick={() => handleExpireSilenceClick(silence.id)}
                  >
                    <Trans i18nKey="silences.table.unsilence-button">Unsilence</Trans>
                  </LinkButton>
                  <LinkButton
                    title={t('alerting.use-columns.title-edit', 'Edit')}
                    size="sm"
                    variant="secondary"
                    icon="pen"
                    href={makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName)}
                  >
                    <Trans i18nKey="silences.table.edit-button">Edit</Trans>
                  </LinkButton>
                </>
              )}
            </Stack>
          );
        },
        size: 5,
      });
    }
    return columns;
  }, [alertManagerSourceName, expireSilence, isGrafanaFlavoredAlertmanager, updateAllowed, updateSupported]);
}

function SilencesTablePage() {
  return (
    <AlertmanagerPageWrapper navId="silences" accessType="instance">
      <SilencesTable />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(SilencesTablePage);
