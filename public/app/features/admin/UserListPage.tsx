import React, { useState } from 'react';

import UsersListPage from '../users/UsersListPage';

import UserListAdminPage from './UserListAdminPage';

export function UserListPage() {
  const [view, setView] = useState('admin');

  return (
    <div>
      <p>Test</p>
      {view === 'admin' ? <UserListAdminPage /> : <UsersListPage />}
    </div>
  );
}
