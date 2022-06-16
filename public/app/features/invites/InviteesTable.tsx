import React, { PureComponent } from 'react';

import { Invitee } from 'app/types';

import InviteeRow from './InviteeRow';

export interface Props {
  invitees: Invitee[];
}

export default class InviteesTable extends PureComponent<Props> {
  render() {
    const { invitees } = this.props;

    return (
      <table className="filter-table form-inline">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th />
            <th style={{ width: '34px' }} />
          </tr>
        </thead>
        <tbody data-testid="InviteesTable-body">
          {invitees.map((invitee, index) => {
            return <InviteeRow key={`${invitee.id}-${index}`} invitee={invitee} />;
          })}
        </tbody>
      </table>
    );
  }
}
