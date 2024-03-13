import { css } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ConfirmModal, IconButton, Link, LinkButton, Menu, Stack, useStyles2 } from '@grafana/ui';
import { MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types/store';

import { Authorize } from '../../components/Authorize';
import { AlertmanagerAction, useAlertmanagerAbilities, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { deleteMuteTimingAction } from '../../state/actions';
import { makeAMLink } from '../../utils/misc';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { EmptyAreaWithCTA } from '../EmptyAreaWithCTA';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';
import { GrafanaMuteTimingsExporter } from '../export/GrafanaMuteTimingsExporter';

import { mergeTimeIntervals, renderTimeIntervals } from './util';

const ALL_MUTE_TIMINGS = Symbol('all mute timings');

type ExportProps = [JSX.Element | null, (muteTiming: string | typeof ALL_MUTE_TIMINGS) => void];

const useExportMuteTiming = (): ExportProps => {
  const [muteTimingName, setMuteTimingName] = useState<string | typeof ALL_MUTE_TIMINGS | null>(null);
  const [isExportDrawerOpen, toggleShowExportDrawer] = useToggle(false);

  const handleClose = useCallback(() => {
    setMuteTimingName(null);
    toggleShowExportDrawer(false);
  }, [toggleShowExportDrawer]);

  const handleOpen = (receiverName: string | typeof ALL_MUTE_TIMINGS) => {
    setMuteTimingName(receiverName);
    toggleShowExportDrawer(true);
  };

  const drawer = useMemo(() => {
    if (!muteTimingName || !isExportDrawerOpen) {
      return null;
    }

    if (muteTimingName === ALL_MUTE_TIMINGS) {
      // use this drawer when we want to export all mute timings
      return <GrafanaMuteTimingsExporter onClose={handleClose} />;
    } else {
      // use this one for exporting a single mute timing
      return <GrafanaMuteTimingsExporter muteTimingName={muteTimingName} onClose={handleClose} />;
    }
  }, [isExportDrawerOpen, handleClose, muteTimingName]);

  return [drawer, handleOpen];
};

interface MuteTimingsTableProps {
  alertManagerSourceName: string;
  muteTimingNames?: string[];
  hideActions?: boolean;
}

export const MuteTimingsTable = ({ alertManagerSourceName, muteTimingNames, hideActions }: MuteTimingsTableProps) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  const { currentData } = useAlertmanagerConfig(alertManagerSourceName, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const config = currentData?.alertmanager_config;

  const [muteTimingName, setMuteTimingName] = useState<string>('');
  const items = useMemo((): Array<DynamicTableItemProps<MuteTimeInterval>> => {
    // merge both fields mute_time_intervals and time_intervals to support both old and new config
    const muteTimings = config ? mergeTimeIntervals(config) : [];
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
  }, [muteTimingNames, config]);

  const [_, allowedToCreateMuteTiming] = useAlertmanagerAbility(AlertmanagerAction.CreateMuteTiming);

  const [ExportDrawer, showExportDrawer] = useExportMuteTiming();
  const [exportMuteTimingsSupported, exportMuteTimingsAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.ExportMuteTimings
  );
  const columns = useColumns(alertManagerSourceName, hideActions, setMuteTimingName, showExportDrawer);

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
              className={styles.muteTimingsButtons}
              icon="plus"
              variant="primary"
              href={makeAMLink('alerting/routes/mute-timing/new', alertManagerSourceName)}
            >
              Add mute timing
            </LinkButton>
          </Authorize>
        )}
        {exportMuteTimingsSupported && (
          <Button
            icon="download-alt"
            className={styles.muteTimingsButtons}
            variant="secondary"
            aria-label="export all"
            disabled={!exportMuteTimingsAllowed}
            onClick={() => showExportDrawer(ALL_MUTE_TIMINGS)}
          >
            Export all
          </Button>
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
      {ExportDrawer}
    </div>
  );
};

function useColumns(
  alertManagerSourceName: string,
  hideActions = false,
  setMuteTimingName: (name: string) => void,
  openExportDrawer: (muteTiming: string | typeof ALL_MUTE_TIMINGS) => void
) {
  const [[_editSupported, allowedToEdit], [_deleteSupported, allowedToDelete]] = useAlertmanagerAbilities([
    AlertmanagerAction.UpdateMuteTiming,
    AlertmanagerAction.DeleteMuteTiming,
  ]);
  const showActions = !hideActions && (allowedToEdit || allowedToDelete);

  // const [ExportDrawer, openExportDrawer] = useExportMuteTiming();
  // const [_, openExportDrawer] = useExportMuteTiming();
  const [exportSupported, exportAllowed] = useAlertmanagerAbility(AlertmanagerAction.ExportMuteTimings);

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
        size: '80px',
      });
    }
    if (exportSupported) {
      columns.push({
        id: 'actions',
        label: '',
        renderCell: function renderActions({ data }) {
          return (
            <div>
              <Menu.Item
                icon="download-alt"
                label="Export"
                ariaLabel="export"
                disabled={!exportAllowed}
                data-testid="export"
                onClick={() => openExportDrawer(data.name)}
              />
            </div>
          );
        },
        size: '100px',
      });
    }
    return columns;
  }, [alertManagerSourceName, setMuteTimingName, showActions, exportSupported, exportAllowed, openExportDrawer]);
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-flow: column nowrap;
  `,
  muteTimingsButtons: css`
    margin-bottom: ${theme.spacing(2)};
    align-self: flex-end;
  `,
});
