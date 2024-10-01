import { PureComponent } from 'react';

import { dateTimeFormat } from '@grafana/data';
import { Button, LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, SyncInfo, UserDTO } from 'app/types';

import { TagBadge } from '../../core/components/TagFilter/TagBadge';

interface Props {
  ldapSyncInfo: SyncInfo;
  user: UserDTO;
  onUserSync: () => void;
}

interface State {}

const format = 'dddd YYYY-MM-DD HH:mm zz';
const debugLDAPMappingBaseURL = '/admin/authentication/ldap';

export class UserLdapSyncInfo extends PureComponent<Props, State> {
  onUserSync = () => {
    this.props.onUserSync();
  };

  render() {
    const { ldapSyncInfo, user } = this.props;
    const nextSyncSuccessful = ldapSyncInfo && ldapSyncInfo.nextSync;
    const nextSyncTime = nextSyncSuccessful ? dateTimeFormat(ldapSyncInfo.nextSync, { format }) : '';
    const debugLDAPMappingURL = `${debugLDAPMappingBaseURL}?user=${user && user.login}`;
    const canReadLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersRead);
    const canSyncLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersSync);

    return (
      <>
        <h3 className="page-heading">LDAP Synchronisation</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <tbody>
                <tr>
                  <td>External sync</td>
                  <td>User synced via LDAP. Some changes must be done in LDAP or mappings.</td>
                  <td>
                    <TagBadge label="LDAP" removeIcon={false} count={0} onClick={undefined} />
                  </td>
                </tr>
                <tr>
                  {ldapSyncInfo.enabled ? (
                    <>
                      <td>Next scheduled synchronization</td>
                      <td colSpan={2}>{nextSyncTime}</td>
                    </>
                  ) : (
                    <>
                      <td>Next scheduled synchronization</td>
                      <td colSpan={2}>Not enabled</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="gf-form-button-row">
            {canSyncLDAPUser && (
              <Button variant="secondary" onClick={this.onUserSync}>
                Sync user
              </Button>
            )}
            {canReadLDAPUser && (
              <LinkButton variant="secondary" href={debugLDAPMappingURL}>
                Debug LDAP Mapping
              </LinkButton>
            )}
          </div>
        </div>
      </>
    );
  }
}
