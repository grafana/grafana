import React from 'react';
import { Button, Input, Modal, stylesFactory, TextArea, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

interface Dashboard {
  name: string;
  lastEdited: string;
  author: string;
}

interface Props {
  affectedDashboards: Dashboard[];
}

export const LibraryPanelModal = ({ affectedDashboards }: Props) => {
  const theme = useTheme();
  const styles = getModalStyles(theme);

  return (
    <Modal title="Update all panel instances">
      <div className={styles.container}>
        <div>
          This update will affect <b>{affectedDashboards.length} dashboards</b>
        </div>
        <div>The following dashboards using the panel will be affected:</div>
        <Input placeholder="Search affected dashboards" />
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Dashboard name</th>
              <th>Last edited</th>
              <th>by</th>
            </tr>
          </thead>
          <tbody>
            {affectedDashboards.map((dash, i) => (
              <tr key={`dash-${i}`}>
                <td>{dash.name}</td>
                <td>{dash.lastEdited}</td>
                <td>{dash.author}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <TextArea placeholder="Add a note to describe your changes..." />
        <div>
          <Button>Update all</Button>
          <Button variant="secondary">Cancel</Button>
        </div>
      </div>
    </Modal>
  );
};

const getModalStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css``,
    table: css`
      tr {
        background: #141619;

        &:nth-child(odd) {
          background: #202226;
        }
      }
    `,
  };
});
