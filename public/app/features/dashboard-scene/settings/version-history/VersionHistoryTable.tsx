import { css, cx } from '@emotion/css';
import * as React from 'react';
import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Checkbox, Button, Tag, ModalsController, Switch, useStyles2, Stack } from '@grafana/ui';
import { DecoratedRevisionModel } from 'app/features/dashboard/types/revisionModels';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { RevertDashboardModal } from './RevertDashboardModal';

type VersionsTableProps = {
  versions: DecoratedRevisionModel[];
  canCompare: boolean;
  onCheck: (ev: React.FormEvent<HTMLInputElement>, versionId: number) => void;
  onRestore: (version: DecoratedRevisionModel) => Promise<boolean>;
  isLoadingUserDisplayNames?: boolean;
};

export const VersionHistoryTable = ({
  versions,
  canCompare,
  onCheck,
  onRestore,
  isLoadingUserDisplayNames,
}: VersionsTableProps) => {
  const styles = useStyles2(getStyles);
  const [showAutoSaves, setShowAutoSaves] = useState(false);

  const hasAutoSaves = versions.some((v) => v.versionType === 'auto');
  const filteredVersions = showAutoSaves ? versions : versions.filter((v) => v.versionType !== 'auto');

  return (
    <div className={styles.margin}>
      {hasAutoSaves && (
        <Stack alignItems="center" gap={1}>
          <Switch
            value={showAutoSaves}
            onChange={() => setShowAutoSaves(!showAutoSaves)}
            data-testid="show-auto-saves-toggle"
          />
          <label
            className={styles.toggleLabel}
            onClick={() => setShowAutoSaves(!showAutoSaves)}
          >
            <Trans i18nKey="dashboard-scene.version-history-table.show-auto-saves">Show auto-saves</Trans>
          </label>
        </Stack>
      )}
      <table className={cx('filter-table', styles.table)}>
        <thead>
          <tr>
            <th className="width-4"></th>
            <th className="width-4">
              <Trans i18nKey="dashboard-scene.version-history-table.version">Version</Trans>
            </th>
            <th className="width-14">
              <Trans i18nKey="dashboard-scene.version-history-table.date">Date</Trans>
            </th>
            <th className="width-10">
              <Trans i18nKey="dashboard-scene.version-history-table.updated-by">Updated by</Trans>
            </th>
            <th>
              <Trans i18nKey="dashboard-scene.version-history-table.notes">Notes</Trans>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredVersions.map((version, idx) => {
            const isAuto = version.versionType === 'auto';
            return (
              <tr key={version.id} className={cx(isAuto && styles.autoSaveRow)} data-testid="version-row">
                <td>
                  <Checkbox
                    aria-label={t(
                      'dashboard-scene.version-history-table.aria-label-toggle-selection',
                      'Toggle selection of version {{version}}',
                      { version: version.version }
                    )}
                    className={css({
                      display: 'inline',
                    })}
                    checked={version.checked}
                    onChange={(ev) => onCheck(ev, version.id)}
                    disabled={!version.checked && canCompare}
                  />
                </td>
                <td>{version.version}</td>
                <td>{version.createdDateString}</td>
                <td>{isLoadingUserDisplayNames ? <Skeleton width={100} /> : version.createdBy}</td>
                <td>
                  {version.message}
                  {isAuto && (
                    <Tag
                      name={t('dashboard-scene.version-history-table.auto-save-tag', 'auto')}
                      className={styles.autoTag}
                    />
                  )}
                </td>
                <td className="text-right">
                  {idx === 0 ? (
                    <Tag name={t('dashboard-scene.version-history-table.name-latest', 'Latest')} colorIndex={17} />
                  ) : (
                    <ModalsController>
                      {({ showModal, hideModal }) => (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="history"
                          onClick={() => {
                            showModal(RevertDashboardModal, {
                              version,
                              hideModal,
                              onRestore,
                            });
                            DashboardInteractions.versionRestoreClicked({
                              version: version.version,
                              index: idx,
                              confirm: false,
                              version_date: new Date(version.created),
                            });
                          }}
                        >
                          <Trans i18nKey="dashboard-scene.version-history-table.restore">Restore</Trans>
                        </Button>
                      )}
                    </ModalsController>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    margin: css({
      marginBottom: theme.spacing(4),
    }),
    table: css({
      td: {
        whiteSpace: 'normal !important',
      },
    }),
    toggleLabel: css({
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      userSelect: 'none',
    }),
    autoSaveRow: css({
      opacity: 0.6,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    autoTag: css({
      marginLeft: theme.spacing(1),
    }),
  };
}
