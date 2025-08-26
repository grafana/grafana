import { PureComponent } from 'react';

import { dateTimeFormat } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';
import { SyncInfo } from 'app/types/ldap';
import { UserDTO } from 'app/types/user';

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
        <h3 className="page-heading">
          <Trans i18nKey="admin.ldap-sync.title">LDAP Synchronisation</Trans>
        </h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <tbody>
                <tr>
                  <td>
                    <Trans i18nKey="admin.ldap-sync.external-sync-label">External sync</Trans>
                  </td>
                  <td>
                    <Trans i18nKey="admin.ldap-sync.external-sync-description">
                      User synced via LDAP. Some changes must be done in LDAP or mappings.
                    </Trans>
                  </td>
                  <td>
                    <TagBadge
                      label={t('admin.user-ldap-sync-info.label-ldap', 'LDAP')}
                      removeIcon={false}
                      count={0}
                      onClick={undefined}
                    />
                  </td>
                </tr>
                <tr>
                  <td>
                    <Trans i18nKey="admin.ldap-sync.next-sync-label">Next scheduled synchronization</Trans>
                  </td>
                  <td colSpan={2}>
                    {ldapSyncInfo.enabled ? (
                      nextSyncTime
                    ) : (
                      <Trans i18nKey="admin.ldap-sync.not-enabled">Not enabled</Trans>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="gf-form-button-row">
            {canSyncLDAPUser && (
              <Button variant="secondary" onClick={this.onUserSync}>
                <Trans i18nKey="admin.ldap-sync.sync-button">Sync user</Trans>
              </Button>
            )}
            {canReadLDAPUser && (
              <LinkButton variant="secondary" href={debugLDAPMappingURL}>
                <Trans i18nKey="admin.ldap-sync.debug-button">Debug LDAP Mapping</Trans>
              </LinkButton>
            )}
          </div>
        </div>
      </>
    );
  }
}
