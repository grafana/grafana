import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query/react';
import * as React from 'react';
import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Checkbox, Button, Tag, ModalsController, useStyles2 } from '@grafana/ui';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { DecoratedRevisionModel } from 'app/features/dashboard/types/revisionModels';

import { RevertDashboardModal } from './RevertDashboardModal';

type VersionsTableProps = {
  versions: DecoratedRevisionModel[];
  canCompare: boolean;
  onCheck: (ev: React.FormEvent<HTMLInputElement>, versionId: number) => void;
};

export const VersionHistoryTable = ({ versions, canCompare, onCheck }: VersionsTableProps) => {
  const styles = useStyles2(getStyles);

  const userKeys = useMemo(() => [...new Set(versions.map((v) => v.createdBy).filter(Boolean))], [versions]);
  const { data: displayData } = useGetDisplayMappingQuery(userKeys.length > 0 ? { key: userKeys } : skipToken);
  const isLoadingUserDisplayNames = userKeys.length > 0 && !displayData;

  const versionsWithDisplayNames = useMemo(() => {
    if (!displayData) {
      return versions;
    }

    const displayMap = new Map<string, string>();
    for (const item of displayData.display) {
      displayMap.set(`${item.identity.type}:${item.identity.name}`, item.displayName);
      if (item.internalId) {
        displayMap.set(String(item.internalId), item.displayName);
      }
    }

    return versions.map((version) => {
      const displayName = version.createdBy ? displayMap.get(version.createdBy) : undefined;
      // users that no longer exist are not in the mapping, so keep the raw key
      return displayName ? { ...version, createdBy: displayName } : version;
    });
  }, [versions, displayData]);

  return (
    <div className={styles.margin}>
      <table className="filter-table">
        <thead>
          <tr>
            <th className="width-4"></th>
            <th className="width-4">
              <Trans i18nKey="dashboard.version-history-table.version">Version</Trans>
            </th>
            <th className="width-14">
              <Trans i18nKey="dashboard.version-history-table.date">Date</Trans>
            </th>
            <th className="width-10">
              <Trans i18nKey="dashboard.version-history-table.updated-by">Updated by</Trans>
            </th>
            <th>
              <Trans i18nKey="dashboard.version-history-table.notes">Notes</Trans>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {versionsWithDisplayNames.map((version, idx) => (
            <tr key={version.id}>
              <td>
                <Checkbox
                  aria-label={t(
                    'dashboard.version-history-table.aria-label-toggle-selection',
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
              <td>{version.message}</td>
              <td className="text-right">
                {idx === 0 ? (
                  <Tag name={t('dashboard.version-history-table.name-latest', 'Latest')} colorIndex={17} />
                ) : (
                  <ModalsController>
                    {({ showModal, hideModal }) => (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="history"
                        onClick={() => {
                          showModal(RevertDashboardModal, {
                            id: version.id,
                            version: version.version,
                            hideModal,
                          });
                        }}
                      >
                        <Trans i18nKey="dashboard.version-history-table.restore">Restore</Trans>
                      </Button>
                    )}
                  </ModalsController>
                )}
              </td>
            </tr>
          ))}
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
  };
}
