import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Button, Tag, ModalsController, useStyles2 } from '@grafana/ui';

import { DecoratedRevisionModel } from '../DashboardSettings/VersionsSettings';

import { RevertDashboardModal } from './RevertDashboardModal';

type VersionsTableProps = {
  versions: DecoratedRevisionModel[];
  canCompare: boolean;
  onCheck: (ev: React.FormEvent<HTMLInputElement>, versionId: number) => void;
};

export const VersionHistoryTable = ({ versions, canCompare, onCheck }: VersionsTableProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.margin}>
      <table className="filter-table">
        <thead>
          <tr>
            <th className="width-4"></th>
            <th className="width-4">Version</th>
            <th className="width-14">Date</th>
            <th className="width-10">Updated by</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version, idx) => (
            <tr key={version.id}>
              <td>
                <Checkbox
                  aria-label={`Toggle selection of version ${version.version}`}
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
              <td>{version.createdBy}</td>
              <td>{version.message}</td>
              <td className="text-right">
                {idx === 0 ? (
                  <Tag name="Latest" colorIndex={17} />
                ) : (
                  <ModalsController>
                    {({ showModal, hideModal }) => (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="history"
                        onClick={() => {
                          showModal(RevertDashboardModal, {
                            version: version.version,
                            hideModal,
                          });
                        }}
                      >
                        Restore
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
