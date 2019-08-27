import React, { FC } from 'react';
import { LdapUserInfo } from 'app/types';

interface Props {
  info: LdapUserInfo;
  className: string;
}

export const LdapUserMappingInfo: FC<Props> = ({ className, info }) => {
  return (
    <>
      <table className={`${className} filter-table form-inline`}>
        <thead>
          <tr>
            <th colSpan={2}>User information</th>
            <th>LDAP attribute</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>First name</td>
            <td>{info.name.ldapValue}</td>
            <td>{info.name.cfgAttrValue}</td>
          </tr>
          <tr>
            <td>Surname</td>
            <td>{info.surname.ldapValue}</td>
            <td>{info.surname.cfgAttrValue}</td>
          </tr>
          <tr>
            <td>Username</td>
            <td>{info.login.ldapValue}</td>
            <td>{info.login.cfgAttrValue}</td>
          </tr>
          <tr>
            <td>Email</td>
            <td>{info.email.ldapValue}</td>
            <td>{info.email.cfgAttrValue}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
};
