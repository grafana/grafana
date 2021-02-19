import React, { FC } from 'react';
import { LdapUserInfo } from 'app/types';

interface Props {
  info: LdapUserInfo;
  showAttributeMapping?: boolean;
}

export const LdapUserMappingInfo: FC<Props> = ({ info, showAttributeMapping }) => {
  return (
    <div className="gf-form-group">
      <div className="gf-form">
        <table className="filter-table form-inline">
          <thead>
            <tr>
              <th colSpan={2}>User information</th>
              {showAttributeMapping && <th>LDAP attribute</th>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="width-16">First name</td>
              <td>{info.name.ldapValue}</td>
              {showAttributeMapping && <td>{info.name.cfgAttrValue}</td>}
            </tr>
            <tr>
              <td className="width-16">Surname</td>
              <td>{info.surname.ldapValue}</td>
              {showAttributeMapping && <td>{info.surname.cfgAttrValue}</td>}
            </tr>
            <tr>
              <td className="width-16">Username</td>
              <td>{info.login.ldapValue}</td>
              {showAttributeMapping && <td>{info.login.cfgAttrValue}</td>}
            </tr>
            <tr>
              <td className="width-16">Email</td>
              <td>{info.email.ldapValue}</td>
              {showAttributeMapping && <td>{info.email.cfgAttrValue}</td>}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
