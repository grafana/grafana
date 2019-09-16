import React, { FC } from 'react';
import { UserInfo } from './UserInfo';
import { LdapUserPermissions } from './ldap/LdapUserPermissions';
import { User } from 'app/types';

interface Props {
  user: User;
  className: string;
}

export const DisabledUserInfo: FC<Props> = ({ className, user }) => {
  return (
    <>
      <LdapUserPermissions
        className={className}
        permissions={{
          isGrafanaAdmin: (user as any).isGrafanaAdmin,
          isDisabled: (user as any).isDisabled,
        }}
      />
      <UserInfo className={className} user={user} />
    </>
  );
};
