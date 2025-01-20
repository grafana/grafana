import moment from 'moment';
import { SetStateAction, useMemo, useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Column,
  ConfirmModal,
  InteractiveTable,
  LoadingPlaceholder,
  Stack,
  Text,
  Tooltip,
} from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../../api/alertRuleApi';
import { stringifyErrorLike } from '../../../utils/misc';

interface VersionData {
  id: string;
  date: string;
  updatedBy: string;
  uid: string;
}
export interface AlertVersionHistoryProps {
  ruleUID: string;
}
const VERSIONS_PAGE_SIZE = 30;

export function AlertVersionHistory({ ruleUID }: AlertVersionHistoryProps) {
  const {
    isLoading,
    currentData: ruleVersions = [],
    error,
  } = alertRuleApi.endpoints.getAlertVersionHistory.useQuery({ uid: ruleUID }, { refetchOnMountOrArgChange: true });
  const [checkedVersions, setCheckedVersions] = useState<Map<string, boolean>>(new Map());
  const numberOfChecked = useMemo(
    () => Array.from(checkedVersions.values()).filter((value) => value).length,
    [checkedVersions]
  );
  const canCompare = numberOfChecked === 2;

  if (error) {
    return (
      <Alert title={t('alerting.alertVersionHistory.errorloading', 'Failed to load alert rule history')}>
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.common.loading', 'Loading...')} />;
  }

  if (!ruleVersions.length) {
    return (
      <Trans i18nKey="alerting.alertVersionHistory.noVersionsFound">
        {/* I think this is not possible? */}
        No versions found for this rule
      </Trans>
    );
  }

  const getDiff = () => {};

  return (
    <Stack direction="column" gap={2}>
      <Text variant="body">
        <Trans i18nKey="alerting.alertVersionHistory.description">
          Each time you edit the alert rule a new version is created. You can restore an older version. Select two
          versions below and compare their differences.
        </Trans>
      </Text>
      <Stack>
        <Tooltip content="Select two versions to start comparing" placement="bottom">
          <Button type="button" disabled={!canCompare} onClick={getDiff} icon="code-branch">
            <Trans i18nKey="alerting.alertVersionHistory.compareVersions">Compare versions</Trans>
          </Button>
        </Tooltip>
      </Stack>
      <VersionHistoryTable
        checkedVersions={checkedVersions}
        setCheckedVersions={setCheckedVersions}
        ruleVersions={ruleVersions}
        numberOfChecked={numberOfChecked}
      />
    </Stack>
  );
}

function VersionHistoryTable({
  checkedVersions,
  setCheckedVersions,
  ruleVersions,
  numberOfChecked,
}: {
  checkedVersions: Map<string, boolean>;
  setCheckedVersions: (value: SetStateAction<Map<string, boolean>>) => void;
  ruleVersions: Array<RulerGrafanaRuleDTO<GrafanaRuleDefinition>>;
  numberOfChecked: number;
}) {
  // const { isLoading, currentData: ruleVersions = [], error } = alertRuleApi.endpoints.getAlertVersionHistory.useQuery(
  //   { uid: ruleUID },
  //   { refetchOnMountOrArgChange: true }
  // );
  // const [checkedVersions, setCheckedVersions] = useState<Map<string, boolean>>(new Map());
  // const numberOfChecked = useMemo(() => Array.from(checkedVersions.values()).filter((value) => value).length, [checkedVersions]);

  // const [activeRestoreVersion, setActiveRestoreVersion] = useState<number | undefined>(undefined);
  const [confirmRestore, setConfirmRestore] = useState(false);

  // which versions are we comparing
  // const [activeComparison, setActiveComparison] = useState<[left: string, right: string] | undefined>(undefined);

  const showConfirmation = () => {
    setConfirmRestore(true);
  };

  const hideConfirmation = () => {
    setConfirmRestore(false);
  };

  // const restoreVersion = (id: number) => {
  //   // setActiveComparison(undefined);
  //   // setActiveRestoreVersion(undefined);
  //   //todo:
  //   // call the API to restore the version
  //   // invalidate cache for the version history
  //   // if an error occurs, show an alert
  // };

  const rows: VersionData[] = ruleVersions.map((rule) => ({
    id: String(rule.grafana_alert.version ?? 0),
    date: rule.grafana_alert.updated ?? 'unknown',
    updatedBy: rule.grafana_alert.updated_by ?? 'unknown',
    uid: rule.grafana_alert.uid,
  }));

  function disabledCheck(id: string) {
    return numberOfChecked === 2 && !checkedVersions.get(id);
  }

  const columns: Array<Column<VersionData>> = [
    {
      disableGrow: true,
      id: 'id',
      header: '',
      cell: ({ value }) => (
        <Stack direction="row">
          <Checkbox
            checked={checkedVersions.get(String(value ?? false)) ?? false}
            disabled={disabledCheck(value)}
            onChange={() => {
              setCheckedVersions((prevState) => {
                const newState = new Map(prevState);
                newState.set(String(value), !prevState.get(String(value)));
                return newState;
              });
            }}
          />
          <Text>{value}</Text>
        </Stack>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      disableGrow: true,
      cell: ({ value }) => moment(value).toLocaleString(),
    },
    {
      id: 'updatedBy',
      header: 'Updated By',
      disableGrow: true,
      cell: ({ value }) => value,
    },
    {
      id: 'actions',
      disableGrow: true,
      cell: ({ row }) => {
        const isFirstItem = row.index === 0;
        // const versionID = Number(row.id);

        return (
          <Stack direction="row" alignItems="center" justifyContent="flex-end">
            {isFirstItem ? (
              <Badge text={t('alerting.alertVersionHistory.latest', 'Latest')} color="blue" />
            ) : (
              <Button
                variant="secondary"
                size="sm"
                icon="history"
                onClick={() => {
                  // setActiveRestoreVersion(versionID);
                  showConfirmation();
                }}
                // disabled={.isLoading} // todo: restoreVersionState.isLoading
              >
                <Trans i18nKey="alerting.alertVersionHistory.restore">Restore</Trans>
              </Button>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <>
      <InteractiveTable pageSize={VERSIONS_PAGE_SIZE} columns={columns} data={rows} getRowId={(row) => row.id} />
      <ConfirmModal
        isOpen={confirmRestore}
        title={t('alerting.alertVersionHistory.restore-modal.title', 'Restore Version')}
        body={t(
          'alerting.alertVersionHistory.restore-modal.body',
          'Are you sure you want to restore the alert rule definition to this version? All unsaved changes will be lost.'
        )}
        confirmText={'Yes, restore configuration'}
        onConfirm={() => {
          // if (activeRestoreVersion) {
          //   restoreVersion(activeRestoreVersion);
          // }

          hideConfirmation();
        }}
        onDismiss={() => hideConfirmation()}
      />
    </>
  );
}
