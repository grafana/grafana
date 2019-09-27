import React, { FC } from 'react';
import { UserInfo } from './UserInfo';
import { LdapUserPermissions } from './ldap/LdapUserPermissions';
import { User } from 'app/types';

interface Props {
  user: User;
}

export const DisabledUserInfo: FC<Props> = ({ user }) => {
  return (
    <>
      <LdapUserPermissions
        permissions={{
          isGrafanaAdmin: (user as any).isGrafanaAdmin,
          isDisabled: (user as any).isDisabled,
        }}
      />
      <UserInfo user={user} />
    </>
  );
};
