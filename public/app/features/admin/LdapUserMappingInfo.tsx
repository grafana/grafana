import React, { FC } from 'react';
import { LdapUserInfo } from '../../types';

interface Props {
  ldapUserInfo: LdapUserInfo;
}

export const LdapUserMappingInfo: FC<Props> = ({ ldapUserInfo }) => {
  return (
    <>
      <h4>Mapping result</h4>
      <table className="filter-table form-inline">
        <thead>
        <tr>
          <th colSpan={2}>User information</th>
          <th>LDAP attribute</th>
        </tr>
        </thead>
        <tbody>
        <tr>
          <td>First name</td>
          <td>{ldapUserInfo.name.ldapValue}</td>
          <td>{ldapUserInfo.name.cfgAttrValue}</td>
        </tr>
        <tr>
          <td>Surname</td>
          <td>{ldapUserInfo.surname.ldapValue}</td>
          <td>{ldapUserInfo.surname.cfgAttrValue}</td>
        </tr>
        <tr>
          <td>Username</td>
          <td>{ldapUserInfo.login.ldapValue}</td>
          <td>{ldapUserInfo.login.cfgAttrValue}</td>
        </tr>
        <tr>
          <td>Email</td>
          <td>{ldapUserInfo.email.ldapValue}</td>
          <td>{ldapUserInfo.email.cfgAttrValue}</td>
        </tr>
        </tbody>
      </table>
    </>
  );
};
