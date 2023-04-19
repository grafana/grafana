import React, { useState } from 'react';

import { Button, ConfirmModal } from '@grafana/ui/src';
import { Page } from 'app/core/components/PageNew/Page';

import { useGetUsersWithActiveSessionsQuery } from '../dashboard/api/publicDashboardApi';
import { SessionUser } from '../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

export const UserListPublicDashboardPage = () => {
  const [userToRemove, setUserToRemove] = useState<SessionUser | null>(null);

  const { data: users, isLoading } = useGetUsersWithActiveSessionsQuery();

  return (
    <Page.Contents isLoading={isLoading}>
      <table className="filter-table form-inline">
        <thead>
          <tr>
            <th>Email</th>
            <th>Seen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users?.map((user) => (
            <tr key={user.email}>
              <td className="max-width-3">
                <span className="ellipsis" title={user.email}>
                  {user.email}
                </span>
              </td>
              <td className="width-1">{user.sessionCreatedAt}</td>
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
