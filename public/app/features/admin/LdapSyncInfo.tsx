import React, { PureComponent } from 'react';

interface Props {
  ldapSyncInfo: {
    enabled: boolean;
    scheduled: string;
    nextScheduled: string;
    lastSync: string;
  };
  headingStyle: string;
  tableStyle: string;
}

interface State {
  isSyncing: boolean;
}

export class LdapSyncInfo extends PureComponent<Props, State> {
  state = {
    isSyncing: false,
  };

  handleSyncClick = () => {
    console.log('Bulk-sync now');
    this.setState({ isSyncing: !this.state.isSyncing });
  };

  render() {
    const { headingStyle, ldapSyncInfo, tableStyle } = this.props;
    const { isSyncing } = this.state;
    return (
      <>
        <h4 className={headingStyle}>
          LDAP Synchronisation
          <button className={`btn btn-secondary pull-right`} onClick={this.handleSyncClick}>
            <span className="btn-title">Bulk-sync now</span>
            {isSyncing && <i className="fa fa-spinner fa-fw fa-spin run-icon" />}
          </button>
        </h4>
        <table className={`${tableStyle} filter-table form-inline`}>
          <tbody>
            <tr>
              <td>Active synchronisation</td>
              <td>{ldapSyncInfo.enabled ? 'Enabled' : 'Disabled'}</td>
            </tr>
            <tr>
              <td>Scheduled</td>
              <td>{ldapSyncInfo.scheduled}</td>
            </tr>
            <tr>
              <td>Next scheduled synchronisation</td>
              <td>{ldapSyncInfo.nextScheduled}</td>
            </tr>
            <tr>
              <td>Last synchronisation</td>
              <td>{ldapSyncInfo.lastSync}</td>
            </tr>
          </tbody>
        </table>
      </>
    );
  }
}
