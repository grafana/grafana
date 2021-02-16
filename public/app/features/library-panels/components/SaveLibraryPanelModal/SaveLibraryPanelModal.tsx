import React, { useState } from 'react';
import { Button, HorizontalGroup, Icon, Input, Modal, stylesFactory, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { useAsync, useDebounce } from 'react-use';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { usePanelSave } from '../../utils/usePanelSave';
import { PanelModel } from 'app/features/dashboard/state';

interface Props {
  panel: PanelModel;
  folderId: number;
  isOpen: boolean;
  onDismiss: () => void;
  connectedDashboards: number[];
}

export const SaveLibraryPanelModal: React.FC<Props> = ({
  panel,
  folderId,
  isOpen,
  onDismiss,
  connectedDashboards,
}: Props) => {
  const [searchString, setSearchString] = useState('');
  const dashState = useAsync(async () => {
    const dashboardDTOs = await getBackendSrv().search({ dashboardIds: connectedDashboards });
    return dashboardDTOs.map((dash) => dash.title);
  }, [connectedDashboards]);
  const [filteredDashboards, setFilteredDashboards] = useState<string[]>([]);
  useDebounce(
    () => {
      if (!dashState.value) {
        return setFilteredDashboards([]);
      }

      return setFilteredDashboards(
        dashState.value.filter((dashName) => dashName.toLowerCase().includes(searchString.toLowerCase()))
      );
    },
    300,
    [dashState.value, searchString]
  );

  const { saveLibraryPanel } = usePanelSave();
  const styles = useStyles(getModalStyles);

  return (
    <Modal title="Update all panel instances" icon="save" onDismiss={onDismiss} isOpen={isOpen}>
      <div>
        <p className={styles.textInfo}>
          {'This update will affect '}
          <strong>
            {connectedDashboards.length} {connectedDashboards.length === 1 ? 'dashboard' : 'dashboards'}.
          </strong>
          The following dashboards using the panel will be affected:
        </p>
        <Input
          className={styles.dashboardSearch}
          prefix={<Icon name="search" />}
          placeholder="Search affected dashboards"
          value={searchString}
          onChange={(e) => setSearchString(e.currentTarget.value)}
        />
        {dashState.loading ? (
          <p>Loading connected dashboards...</p>
        ) : (
          <table className={styles.myTable}>
            <thead>
              <th>Dashboard name</th>
            </thead>
            <tbody>
              {filteredDashboards.map((dashName, i) => (
                <tr key={`dashrow-${i}`}>
                  <td>{dashName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <HorizontalGroup>
          <Button
            onClick={() => {
              saveLibraryPanel(panel, folderId).then(() => onDismiss());
            }}
          >
            Update all
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            Cancel
          </Button>
        </HorizontalGroup>
      </div>
    </Modal>
  );
};

const getModalStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    myTable: css`
      max-height: 204px;
      overflow-y: auto;
      margin-top: 11px;
      margin-bottom: 28px;
      border-radius: ${theme.border.radius.sm};
      border: 1px solid ${theme.colors.bg3};
      background: ${theme.colors.bg1};
      color: ${theme.colors.textSemiWeak};
      font-size: ${theme.typography.size.md};
      width: 100%;

      thead {
        color: #538ade;
        font-size: ${theme.typography.size.sm};
      }

      th,
      td {
        padding: 6px 13px;
        height: ${theme.spacing.xl};
      }

      tr:nth-child(odd) {
        background: ${theme.colors.bg2};
      }
    `,
    noteTextbox: css`
      margin-bottom: ${theme.spacing.xl};
    `,
    textInfo: css`
      color: ${theme.colors.textSemiWeak};
      font-size: ${theme.typography.size.sm};
    `,
    dashboardSearch: css`
      margin-top: ${theme.spacing.md};
    `,
  };
});
