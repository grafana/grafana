import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { IconButton, LinkButton, Link, useStyles2, ConfirmModal } from '@grafana/ui';
import { MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types/store';

import { Authorize } from '../../components/Authorize';
import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { deleteMuteTimingAction } from '../../state/actions';
import { makeAMLink } from '../../utils/misc';
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

  const { currentData } = useAlertmanagerConfig(alertManagerSourceName, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const config = currentData?.alertmanager_config;

  const [muteTimingName, setMuteTimingName] = useState<string>('');

  const items = useMemo((): Array<DynamicTableItemProps<MuteTimeInterval>> => {
    const muteTimings = config?.mute_time_intervals ?? [];
    const muteTimingsProvenances = config?.muteTimeProvenances ?? {};

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
  }, [config?.mute_time_intervals, config?.muteTimeProvenances, muteTimingNames]);

  const columns = useColumns(alertManagerSourceName, hideActions, setMuteTimingName);
  const [_, allowedToCreateMuteTiming] = useAlertmanagerAbility(AlertmanagerAction.CreateMuteTiming);

  return (
    <div className={styles.container}>
      <Stack direction="row" alignItems="center">
        <span>
          Enter specific time intervals when not to send notifications or freeze notifications for recurring periods of
          time.
        </span>
        <Spacer />
        {!hideActions && items.length > 0 && (
          <Authorize actions={[AlertmanagerAction.CreateMuteTiming]}>
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
        <DynamicTable items={items} cols={columns} pagination={{ itemsPerPage: 25 }} />
      ) : !hideActions ? (
        <EmptyAreaWithCTA
          text="You haven't created any mute timings yet"
          buttonLabel="Add mute timing"
          buttonIcon="plus"
          buttonSize="lg"
          href={makeAMLink('alerting/routes/mute-timing/new', alertManagerSourceName)}
          showButton={allowedToCreateMuteTiming}
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
          onConfirm={() => {
            dispatch(deleteMuteTimingAction(alertManagerSourceName, muteTimingName));
            setMuteTimingName('');
          }}
          onDismiss={() => setMuteTimingName('')}
        />
      )}
    </div>
  );
};

function useColumns(alertManagerSourceName: string, hideActions = false, setMuteTimingName: (name: string) => void) {
  const [_editSupported, allowedToEdit] = useAlertmanagerAbility(AlertmanagerAction.UpdateMuteTiming);
  const [_deleteSupported, allowedToDelete] = useAlertmanagerAbility(AlertmanagerAction.DeleteMuteTiming);
  const showActions = !hideActions && (allowedToEdit || allowedToDelete);

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
              <Authorize actions={[AlertmanagerAction.UpdateMuteTiming]}>
                <Link
                  href={makeAMLink(`/alerting/routes/mute-timing/edit`, alertManagerSourceName, {
                    muteName: data.name,
                  })}
                >
                  <IconButton name="edit" tooltip="Edit mute timing" />
                </Link>
              </Authorize>
              <Authorize actions={[AlertmanagerAction.DeleteMuteTiming]}>
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
  }, [alertManagerSourceName, setMuteTimingName, showActions]);
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
