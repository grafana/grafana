import React, { createRef, PureComponent } from 'react';
import { Invitee } from 'app/types';

export interface Props {
  invitees: Invitee[];
  revokeInvite: (code: string) => void;
}

export default class InviteesTable extends PureComponent<Props> {
  private copyRef = createRef<HTMLTextAreaElement>();

  copyToClipboard = () => {
    const node = this.copyRef.current;

    if (node) {
      node.select();
      document.execCommand('copy');
    }
  };

  render() {
    const { invitees, revokeInvite } = this.props;

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
        <tbody>
          {invitees.map((invitee, index) => {
            return (
              <tr key={`${invitee.id}-${index}`}>
                <td>{invitee.email}</td>
                <td>{invitee.name}</td>
                <td className="text-right">
                  <button className="btn btn-inverse btn-mini" onClick={this.copyToClipboard}>
                    <textarea readOnly={true} value={invitee.url} style={{ display: 'none' }} ref={this.copyRef} />
                    <i className="fa fa-clipboard" /> Copy Invite
                  </button>
                  &nbsp;
                </td>
                <td>
                  <button className="btn btn-danger btn-mini" onClick={() => revokeInvite(invitee.code)}>
                    <i className="fa fa-remove" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}
