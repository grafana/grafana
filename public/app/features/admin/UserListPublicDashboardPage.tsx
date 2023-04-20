import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import {
  Button,
  ConfirmModal,
  HorizontalGroup,
  Icon,
  Modal,
  ModalsController,
  Tooltip,
  useStyles2,
  VerticalGroup,
} from '@grafana/ui/src';
import { Page } from 'app/core/components/PageNew/Page';

import { useGetUsersWithActiveSessionsQuery } from '../dashboard/api/publicDashboardApi';
import {
  SessionPublicDashboard,
  SessionUser,
} from '../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

const selectors = e2eSelectors.pages.UserListPage.publicDashboards;

const DashboardsListModal = ({
  dashboards,
  onDismiss,
}: {
  dashboards: SessionPublicDashboard[];
  onDismiss: () => void;
}) => {
  const styles = useStyles2(getStyles);

  return (
    <Modal className={styles.modal} isOpen title="Public Dashboards" onDismiss={onDismiss}>
      <VerticalGroup>
        <p>Name of the dashboard</p>
        <HorizontalGroup>
          <p>Public Dashboard URL</p>
          <p>•</p>
          <p>Public Dashboard Settings</p>
        </HorizontalGroup>
      </VerticalGroup>
    </Modal>
  );
};

const DashboardsListIcon = ({ dashboards }: { dashboards: SessionPublicDashboard[] }) => (
  <ModalsController>
    {({ showModal, hideModal }) => (
      <Button
        variant="secondary"
        size="sm"
        icon="question-circle"
        title="Open dashboards list"
        onClick={() => showModal(DashboardsListModal, { dashboards, onDismiss: hideModal })}
        data-testid="query-tab-help-button"
      />
    )}
  </ModalsController>
);
export const UserListPublicDashboardPage = () => {
  const [userToRemove, setUserToRemove] = useState<SessionUser | null>(null);

  const { data: users, isLoading } = useGetUsersWithActiveSessionsQuery();

  return (
    <Page.Contents isLoading={isLoading}>
      <table className="filter-table form-inline" data-testid={selectors.container}>
        <thead>
          <tr>
            <th>Email</th>
            <th>
              <span>Activated </span>
              <Tooltip placement="top" content={'Earliest time user has been an active user to a dashboard'}>
                <Icon name="question-circle" />
              </Tooltip>
            </th>
            <th>Origin</th>
            <th>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users?.map((user) => (
            <tr key={user.email}>
              <td className="max-width-10">
                <span className="ellipsis" title={user.email}>
                  {user.email}
                </span>
              </td>
              <td className="max-width-10">{user.sessionCreatedAt}</td>
              <td className="max-width-10">
                <HorizontalGroup spacing="sm">
                  <span>{user.publicDashboards!.length} dashboards</span>
                  <DashboardsListIcon dashboards={user.publicDashboards!} />
                </HorizontalGroup>
              </td>
              <td className="max-width-10">{user.publicDashboards!.length}</td>
              <td className="text-right">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setUserToRemove(user)}
                  icon="times"
                  aria-label="Delete user"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmModal
        body={`The user thanos.karachalios@grafana.com is currently present in 3 public dashboards. If you wish to remove this user, please navigate to the settings of the corresponding public dashboard.`}
        confirmText="Delete"
        title="Delete"
        onDismiss={() => {
          setUserToRemove(null);
        }}
        isOpen={!!userToRemove}
        onConfirm={() => {
          setUserToRemove(null);
        }}
      />
    </Page.Contents>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: 590px;
  `,
  modalTitle: css`
    font-size: ${theme.typography.h6.fontSize};
  `,
});
