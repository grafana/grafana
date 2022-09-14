import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Button, ClipboardButton } from '@grafana/ui';
import { Invitee } from 'app/types';

import { revokeInvite } from './state/actions';

const mapDispatchToProps = {
  revokeInvite,
};

const connector = connect(null, mapDispatchToProps);

interface OwnProps {
  invitee: Invitee;
}

export type Props = OwnProps & ConnectedProps<typeof connector>;

class InviteeRow extends PureComponent<Props> {
  render() {
    const { invitee, revokeInvite } = this.props;
    return (
      <tr>
        <td>{invitee.email}</td>
        <td>{invitee.name}</td>
        <td className="text-right">
          <ClipboardButton icon="copy" variant="secondary" size="sm" getText={() => invitee.url}>
            Copy Invite
          </ClipboardButton>
          &nbsp;
        </td>
        <td>
          <Button
            variant="destructive"
            size="sm"
            icon="times"
            onClick={() => revokeInvite(invitee.code)}
            aria-label="Revoke Invite"
          />
        </td>
      </tr>
    );
  }
}

export default connector(InviteeRow);
