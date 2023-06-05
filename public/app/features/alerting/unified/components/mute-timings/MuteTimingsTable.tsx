import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { IconButton, LinkButton, Link, useStyles2, ConfirmModal } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertManagerCortexConfig, MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { Authorize } from '../../components/Authorize';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { deleteMuteTimingAction } from '../../state/actions';
import { getNotificationsPermissions } from '../../utils/access-control';
import { makeAMLink } from '../../utils/misc';
import { AsyncRequestState, initialAsyncRequestState } from '../../utils/redux';
import { DynamicTable, DynamicTableItemProps, DynamicTableColumnProps } from '../DynamicTable';
import { EmptyAreaWithCTA } from '../EmptyAreaWithCTA';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';

import { renderTimeIntervals } from './util';

interface Props {
  alertManagerSourceName: string;
  muteTimingNames?: string[];
  hideActions?: boolean;
}

export const MuteTimingsTable = ({ alertManagerSourceName, muteTimingNames, hideActions }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const permissions = getNotificationsPermissions(alertManagerSourceName);
  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);
  const [muteTimingName, setMuteTimingName] = useState<string>('');
  const { result }: AsyncRequestState<AlertManagerCortexConfig> =
    (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState;

  const items = useMemo((): Array<DynamicTableItemProps<MuteTimeInterval>> => {
    const muteTimings = result?.alertmanager_config?.mute_time_intervals ?? [];
    const muteTimingsProvenances = result?.alertmanager_config?.muteTimeProvenances ?? {};

    return muteTimings
      .filter(({ name }) => (muteTimingNames ? muteTimingNames.includes(name) : true))
      .map((mute) => {
        return {
          id: mute.name,
          data: {
            ...mute,
            provenance: muteTimingsProvenances[mute.name],
          },
        };
      });
  }, [
    result?.alertmanager_config?.mute_time_intervals,
    result?.alertmanager_config?.muteTimeProvenances,
    muteTimingNames,
  ]);

  const columns = useColumns(alertManagerSourceName, hideActions, setMuteTimingName);

  return (
    <div className={styles.container}>
      <Stack direction="row" alignItems="center">
        <span>
          Enter specific time intervals when not to send notifications or freeze notifications for recurring periods of
          time.
        </span>
        <Spacer />
        {!hideActions && items.length > 0 && (
          <Authorize actions={[permissions.create]}>
            <LinkButton
              className={styles.addMuteButton}
              icon="plus"
              variant="primary"
              href={makeAMLink('alerting/routes/mute-timing/new', alertManagerSourceName)}
            >
              Add mute timing
            </LinkButton>
          </Authorize>
        )}
      </Stack>
      {items.length > 0 ? (
        <DynamicTable items={items} cols={columns} />
      ) : !hideActions ? (
        <EmptyAreaWithCTA
          text="You haven't created any mute timings yet"
          buttonLabel="Add mute timing"
          buttonIcon="plus"
          buttonSize="lg"
          href={makeAMLink('alerting/routes/mute-timing/new', alertManagerSourceName)}
          showButton={contextSrv.hasPermission(permissions.create)}
        />
      ) : (
        <EmptyAreaWithCTA text="No mute timings configured" buttonLabel={''} showButton={false} />
      )}
      {!hideActions && (
        <ConfirmModal
          isOpen={!!muteTimingName}
          title="Delete mute timing"
          body={`Are you sure you would like to delete "${muteTimingName}"`}
          confirmText="Delete"
          onConfirm={() => dispatch(deleteMuteTimingAction(alertManagerSourceName, muteTimingName))}
          onDismiss={() => setMuteTimingName('')}
        />
      )}
    </div>
  );
};

function useColumns(alertManagerSourceName: string, hideActions = false, setMuteTimingName: (name: string) => void) {
  const permissions = getNotificationsPermissions(alertManagerSourceName);

  const userHasEditPermissions = contextSrv.hasPermission(permissions.update);
  const userHasDeletePermissions = contextSrv.hasPermission(permissions.delete);
  const showActions = !hideActions && (userHasEditPermissions || userHasDeletePermissions);

  return useMemo((): Array<DynamicTableColumnProps<MuteTimeInterval>> => {
    const columns: Array<DynamicTableColumnProps<MuteTimeInterval>> = [
      {
        id: 'name',
        label: 'Name',
        renderCell: function renderName({ data }) {
          return (
            <>
              {data.name} {data.provenance && <ProvisioningBadge />}
            </>
          );
        },
        size: '250px',
      },
      {
        id: 'timeRange',
        label: 'Time range',
        renderCell: ({ data }) => {
          return renderTimeIntervals(data);
        },
      },
    ];
    if (showActions) {
      columns.push({
        id: 'actions',
        label: 'Actions',
        renderCell: function renderActions({ data }) {
          if (data.provenance) {
            return (
              <div>
                <Link
                  href={makeAMLink(`/alerting/routes/mute-timing/edit`, alertManagerSourceName, {
                    muteName: data.name,
                  })}
                >
                  <IconButton name="file-alt" tooltip="View mute timing" />
                </Link>
              </div>
            );
          }
          return (
            <div>
              <Authorize actions={[permissions.update]}>
                <Link
                  href={makeAMLink(`/alerting/routes/mute-timing/edit`, alertManagerSourceName, {
                    muteName: data.name,
                  })}
                >
                  <IconButton name="edit" tooltip="Edit mute timing" />
                </Link>
              </Authorize>
              <Authorize actions={[permissions.delete]}>
                <IconButton
                  name="trash-alt"
                  tooltip="Delete mute timing"
                  onClick={() => setMuteTimingName(data.name)}
                />
              </Authorize>
            </div>
          );
        },
        size: '100px',
      });
    }
    return columns;
  }, [alertManagerSourceName, setMuteTimingName, showActions, permissions]);
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-flow: column nowrap;
  `,
  addMuteButton: css`
    margin-bottom: ${theme.spacing(2)};
    align-self: flex-end;
  `,
});
