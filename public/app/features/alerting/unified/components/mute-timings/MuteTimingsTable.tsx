import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, LinkButton, LoadingPlaceholder, Stack, useStyles2 } from '@grafana/ui';
import { MuteTimingActionsButtons } from 'app/features/alerting/unified/components/mute-timings/MuteTimingActionsButtons';
import {
  ALL_MUTE_TIMINGS,
  useExportMuteTimingsDrawer,
} from 'app/features/alerting/unified/components/mute-timings/useExportMuteTimingsDrawer';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { PROVENANCE_ANNOTATION } from 'app/features/alerting/unified/utils/k8s/constants';

import { Authorize } from '../../components/Authorize';
import { AlertmanagerAction, useAlertmanagerAbilities, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { makeAMLink } from '../../utils/misc';
import { DynamicTable, DynamicTableColumnProps } from '../DynamicTable';
import { EmptyAreaWithCTA } from '../EmptyAreaWithCTA';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';

import { MuteTiming, useMuteTimings } from './useMuteTimings';
import { renderTimeIntervals } from './util';

type TableItem = {
  id: string;
  data: MuteTiming;
};

export const TimeIntervalsTable = () => {
  const { selectedAlertmanager: alertManagerSourceName = '', hasConfigurationAPI } = useAlertmanager();
  const hideActions = !hasConfigurationAPI;
  const styles = useStyles2(getStyles);
  const [ExportAllDrawer, showExportAllDrawer] = useExportMuteTimingsDrawer();

  const { data, isLoading, error } = useMuteTimings({ alertmanager: alertManagerSourceName ?? '' });

  const items = useMemo((): TableItem[] => {
    const muteTimings = data || [];

    return muteTimings.map((mute) => {
      return {
        id: mute.id,
        data: mute,
      };
    });
  }, [data]);

  const [_, allowedToCreateMuteTiming] = useAlertmanagerAbility(AlertmanagerAction.CreateTimeInterval);

  const [exportMuteTimingsSupported, exportMuteTimingsAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.ExportTimeIntervals
  );
  const columns = useColumns(alertManagerSourceName, hideActions);

  if (isLoading) {
    return (
      <LoadingPlaceholder
        text={t('alerting.time-intervals-table.text-loading-time-intervals', 'Loading time intervals...')}
      />
    );
  }

  if (error) {
    return (
      <Alert severity="error" title={t('alerting.time-intervals.error-loading.title', 'Error loading time intervals')}>
        <Trans i18nKey="alerting.time-intervals.error-loading.description">
          Could not load time intervals. Please try again later.
        </Trans>
      </Alert>
    );
  }

  return (
    <div className={styles.container}>
      <Stack direction="row" alignItems="center">
        <Trans i18nKey="alerting.time-intervals.description">
          Enter specific time intervals when not to send notifications or freeze notifications for recurring periods of
          time.
        </Trans>
        <Spacer />
        {!hideActions && items.length > 0 && (
          <Authorize actions={[AlertmanagerAction.CreateTimeInterval]}>
            <LinkButton
              className={styles.muteTimingsButtons}
              icon="plus"
              variant="primary"
              href={makeAMLink('alerting/routes/mute-timing/new', alertManagerSourceName)}
            >
              <Trans i18nKey="alerting.time-interval.add-time-interval">Add time interval</Trans>
            </LinkButton>
          </Authorize>
        )}
        {exportMuteTimingsSupported && (
          <>
            <Button
              icon="download-alt"
              className={styles.muteTimingsButtons}
              variant="secondary"
              disabled={!exportMuteTimingsAllowed}
              onClick={() => showExportAllDrawer(ALL_MUTE_TIMINGS)}
            >
              <Trans i18nKey="alerting.common.export-all">Export all</Trans>
            </Button>
            {ExportAllDrawer}
          </>
        )}
      </Stack>
      {items.length > 0 ? <DynamicTable items={items} cols={columns} pagination={{ itemsPerPage: 25 }} /> : null}
      {items.length === 0 && (
        <>
          {!hideActions ? (
            <EmptyAreaWithCTA
              text={t(
                'alerting.time-intervals-table.text-havent-created-time-intervals',
                "You haven't created any time intervals yet"
              )}
              buttonLabel="Add time interval"
              buttonIcon="plus"
              buttonSize="lg"
              href={makeAMLink('alerting/routes/mute-timing/new', alertManagerSourceName)}
              showButton={allowedToCreateMuteTiming}
            />
          ) : (
            <EmptyAreaWithCTA
              text={t(
                'alerting.time-intervals-table.text-no-time-intervals-configured',
                'No time intervals configured'
              )}
              buttonLabel={''}
              showButton={false}
            />
          )}
        </>
      )}
    </div>
  );
};

function useColumns(alertManagerSourceName: string, hideActions = false) {
  const [[_editSupported, allowedToEdit], [_deleteSupported, allowedToDelete]] = useAlertmanagerAbilities([
    AlertmanagerAction.UpdateTimeInterval,
    AlertmanagerAction.DeleteTimeInterval,
  ]);
  const showActions = !hideActions && (allowedToEdit || allowedToDelete);

  return useMemo((): Array<DynamicTableColumnProps<MuteTiming>> => {
    const columns: Array<DynamicTableColumnProps<MuteTiming>> = [
      {
        id: 'name',
        label: t('alerting.use-columns.columns.label.name', 'Name'),
        renderCell: function renderName({ data }) {
          return (
            <div>
              {data.name}{' '}
              {data.provisioned && (
                <ProvisioningBadge tooltip provenance={data.metadata?.annotations?.[PROVENANCE_ANNOTATION]} />
              )}
            </div>
          );
        },
        size: 1,
      },
      {
        id: 'timeRange',
        label: t('alerting.use-columns.columns.label.time-range', 'Time range'),
        renderCell: ({ data }) => {
          return renderTimeIntervals(data);
        },
        size: 5,
      },
    ];
    if (showActions) {
      columns.push({
        id: 'actions',
        label: t('alerting.use-columns.label.actions', 'Actions'),
        alignColumn: 'end',
        renderCell: ({ data }) => (
          <MuteTimingActionsButtons muteTiming={data} alertManagerSourceName={alertManagerSourceName} />
        ),
        size: 2,
      });
    }
    return columns;
  }, [showActions, alertManagerSourceName]);
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexFlow: 'column nowrap',
  }),
  muteTimingsButtons: css({
    marginBottom: theme.spacing(2),
  }),
});
