import React, { PureComponent } from 'react';

import { dateTimeFormat } from '@grafana/data';
import { Button, InteractiveTable, Spinner, Text } from '@grafana/ui';
import { SyncInfo } from 'app/types';

interface Props {
  ldapSyncInfo: SyncInfo;
}

interface State {
  isSyncing: boolean;
}

const format = 'dddd YYYY-MM-DD HH:mm zz';

export class LdapSyncInfo extends PureComponent<Props, State> {
  state = {
    isSyncing: false,
  };

  handleSyncClick = () => {
    this.setState({ isSyncing: !this.state.isSyncing });
  };

  render() {
    const { ldapSyncInfo } = this.props;
    const { isSyncing } = this.state;
    const nextSyncTime = dateTimeFormat(ldapSyncInfo.nextSync, { format });

    const columns = [{ id: 'syncAttribute' }, { id: 'syncValue' }];
    const data = [
      {
        syncAttribute: 'Active synchronization',
        syncValue: ldapSyncInfo.enabled ? 'Enabled' : 'Disabled',
      },
      {
        syncAttribute: 'Scheduled',
        syncValue: ldapSyncInfo.schedule,
      },
      {
        syncAttribute: 'Next synchronization',
        syncValue: nextSyncTime,
      },
    ];

    return (
      <section>
        <Text element="h3">
          LDAP Synchronization
          <Button className="pull-right" onClick={this.handleSyncClick} hidden>
            <span className="btn-title">Bulk-sync now</span>
            {isSyncing && <Spinner inline={true} />}
          </Button>
        </Text>
        <InteractiveTable data={data} columns={columns} getRowId={(sync) => sync.syncAttribute} />
      </section>
    );
  }
}
