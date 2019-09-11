import React, { PureComponent } from 'react';
import { dateTime } from '@grafana/data';
import { LdapUserSyncInfo } from 'app/types';

interface Props {
  syncInfo: LdapUserSyncInfo;
  headingStyle: string;
  tableStyle: string;
  onSync?: () => void;
}

interface State {
  isSyncing: boolean;
}

const syncTimeFormat = 'dddd YYYY-MM-DD HH:mm zz';

export class UserSyncInfo extends PureComponent<Props, State> {
  state = {
    isSyncing: false,
  };

  handleSyncClick = async () => {
    const { onSync } = this.props;
    this.setState({ isSyncing: true });
    try {
      if (onSync) {
        await onSync();
      }
    } finally {
      this.setState({ isSyncing: false });
    }
  };

  render() {
    const { headingStyle, tableStyle, syncInfo } = this.props;
    const { isSyncing } = this.state;
    const nextSyncTime = dateTime(syncInfo.nextSync).format(syncTimeFormat);
    const prevSyncSuccessful = syncInfo && syncInfo.prevSync;
    const prevSyncTime = prevSyncSuccessful ? dateTime(syncInfo.prevSync).format(syncTimeFormat) : '';

    return (
      <>
        <h4 className={headingStyle}>
          LDAP Synchronisation
          <button className={`btn btn-secondary pull-right`} onClick={this.handleSyncClick}>
            <span className="btn-title">Sync user</span>
            {isSyncing && <i className="fa fa-spinner fa-fw fa-spin run-icon" />}
          </button>
        </h4>
        <table className={`${tableStyle} filter-table form-inline`}>
          <tbody>
            <tr>
              <td>Next scheduled synchronisation</td>
              <td colSpan={2}>{nextSyncTime}</td>
            </tr>
            <tr>
              <td>Last synchronisation</td>
              <td>{prevSyncTime}</td>
              {prevSyncSuccessful && <td className="pull-right">Successful</td>}
            </tr>
          </tbody>
        </table>
      </>
    );
  }
}
