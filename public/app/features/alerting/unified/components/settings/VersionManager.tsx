import { css } from '@emotion/css';
import { omit } from 'lodash';
import moment from 'moment';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Alert,
  Badge,
  Button,
  CellProps,
  Column,
  ConfirmModal,
  InteractiveTable,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { DiffViewer } from 'app/features/dashboard-scene/settings/version-history/DiffViewer';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { computeVersionDiff } from '../../utils/diff';
import { stringifyErrorLike } from '../../utils/misc';
import { Spacer } from '../Spacer';

const VERSIONS_PAGE_SIZE = 30;

interface AlertmanagerConfigurationVersionManagerProps {
  alertmanagerName: string;
}

type Diff = {
  added: number;
  removed: number;
};

type VersionData = {
  id: string;
  lastAppliedAt: string;
  diff: Diff;
};

interface ConfigWithDiff extends AlertManagerCortexConfig {
  diff: Diff;
}

const AlertmanagerConfigurationVersionManager = ({
  alertmanagerName,
}: AlertmanagerConfigurationVersionManagerProps) => {
  // we'll track the ID of the version we want to restore
  const [activeRestoreVersion, setActiveRestoreVersion] = useState<number | undefined>(undefined);
  const [confirmRestore, setConfirmRestore] = useState(false);

  // in here we'll track the configs we are comparing
  const [activeComparison, setActiveComparison] = useState<[left: string, right: string] | undefined>(undefined);

  const {
    currentData: historicalConfigs = [],
    isLoading,
    error,
  } = alertmanagerApi.endpoints.getAlertmanagerConfigurationHistory.useQuery(undefined);

  const [resetAlertManagerConfigToOldVersion, restoreVersionState] =
    alertmanagerApi.endpoints.resetAlertmanagerConfigurationToOldVersion.useMutation();

  const showConfirmation = () => {
    setConfirmRestore(true);
  };

  const hideConfirmation = () => {
    setConfirmRestore(false);
  };

  const restoreVersion = (id: number) => {
    setActiveComparison(undefined);
    setActiveRestoreVersion(undefined);

    resetAlertManagerConfigToOldVersion({ id });
  };

  if (error) {
    return <Alert title="Failed to load configuration history">{stringifyErrorLike(error)}</Alert>;
  }

  if (isLoading) {
    return 'Loading...';
  }

  if (!historicalConfigs.length) {
    return 'No previous configurations';
  }

  // with this function we'll compute the diff with the previous version; that way the user can get some idea of how many lines where changed in each update that was applied
  const previousVersions: ConfigWithDiff[] = historicalConfigs.map((config, index) => {
    const latestConfig = historicalConfigs[0];
    const priorConfig = historicalConfigs[index];

    return {
      ...config,
      diff: priorConfig ? computeVersionDiff(config, latestConfig, normalizeConfig) : { added: 0, removed: 0 },
    };
  });

  const rows: VersionData[] = previousVersions.map((version) => ({
    id: String(version.id ?? 0),
    lastAppliedAt: version.last_applied ?? 'unknown',
    diff: version.diff,
  }));

  const columns: Array<Column<VersionData>> = [
    {
      id: 'lastAppliedAt',
      header: 'Last applied',
      cell: LastAppliedCell,
    },
    {
      id: 'diff',
      disableGrow: true,
      cell: ({ row, value }) => {
        const isLatestConfiguration = row.index === 0;
        if (isLatestConfiguration) {
          return null;
        }

        return (
          <Stack alignItems="baseline" gap={0.5}>
            <Text color="success" variant="bodySmall">
              +{value.added}
            </Text>
            <Text color="error" variant="bodySmall">
              -{value.removed}
            </Text>
          </Stack>
        );
      },
    },
    {
      id: 'actions',
      disableGrow: true,
      cell: ({ row }) => {
        const isFirstItem = row.index === 0;
        const versionID = Number(row.id);

        return (
          <Stack direction="row" alignItems="center" justifyContent="flex-end">
            {isFirstItem ? (
              <Badge text="Latest" color="blue" />
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="code-branch"
                  fill="outline"
                  onClick={() => {
                    const latestConfiguration = historicalConfigs[0];
                    const historicalConfiguration = historicalConfigs[row.index];

                    const left = normalizeConfig(latestConfiguration);
                    const right = normalizeConfig(historicalConfiguration);

                    setActiveRestoreVersion(versionID);
                    setActiveComparison([JSON.stringify(left, null, 2), JSON.stringify(right, null, 2)]);
                  }}
                >
                  Compare
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="history"
                  onClick={() => {
                    setActiveRestoreVersion(versionID);
                    showConfirmation();
                  }}
                  disabled={restoreVersionState.isLoading}
                >
                  Restore
                </Button>
              </>
            )}
          </Stack>
        );
      },
    },
  ];

  if (restoreVersionState.isLoading) {
    return (
      <Alert severity="info" title="Restoring Alertmanager configuration">
        This might take a while...
      </Alert>
    );
  }

  return (
    <>
      {activeComparison ? (
        <CompareVersions
          left={activeComparison[0]}
          right={activeComparison[1]}
          disabled={restoreVersionState.isLoading}
          onCancel={() => {
            setActiveRestoreVersion(undefined);
            setActiveComparison(undefined);
            hideConfirmation();
          }}
          onConfirm={() => {
            showConfirmation();
          }}
        />
      ) : (
        <InteractiveTable pageSize={VERSIONS_PAGE_SIZE} columns={columns} data={rows} getRowId={(row) => row.id} />
      )}
      {/* TODO make this modal persist while restore is in progress */}
      <ConfirmModal
        isOpen={confirmRestore}
        title={'Restore Version'}
        body={'Are you sure you want to restore the configuration to this version? All unsaved changes will be lost.'}
        confirmText={'Yes, restore configuration'}
        onConfirm={() => {
          if (activeRestoreVersion) {
            restoreVersion(activeRestoreVersion);
          }

          hideConfirmation();
        }}
        onDismiss={() => hideConfirmation()}
      />
    </>
  );
};

interface CompareVersionsProps {
  left: string;
  right: string;

  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function CompareVersions({ left, right, disabled = false, onCancel, onConfirm }: CompareVersionsProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.drawerWrapper}>
      <div className={styles.diffWrapper}>
        {/*
          we're hiding the line numbers because the historical snapshots will have certain parts of the config hidden (ex. auto-generated policies)
          so the line numbers will not match up with what you can see in the JSON modal tab
        */}
        <DiffViewer newValue={left} oldValue={right} hideLineNumbers={true} />
      </div>
      <Stack direction="row" alignItems="center">
        <Spacer />
        <Button variant="secondary" onClick={onCancel} disabled={disabled}>
          Return
        </Button>
        <Button icon="history" variant="primary" onClick={onConfirm} disabled={disabled}>
          Restore
        </Button>
      </Stack>
    </div>
  );
}

const LastAppliedCell = ({ value }: CellProps<VersionData>) => {
  const date = moment(value);

  return (
    <Stack direction="row" alignItems="center">
      {date.toLocaleString()}
      <Text variant="bodySmall" color="secondary">
        {date.fromNow()}
      </Text>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  drawerWrapper: css({
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  diffWrapper: css({
    overflowY: 'auto',
  }),
});

// these props are part of the historical config response but not the current config, so we remove them for fair comparison
function normalizeConfig(config: AlertManagerCortexConfig) {
  return omit(config, ['id', 'last_applied']);
}

export { AlertmanagerConfigurationVersionManager };
