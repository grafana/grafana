import React, { createRef, PureComponent } from 'react';
import { connect } from 'react-redux';
import { Invitee } from 'app/types';
import { revokeInvite } from './state/actions';

export interface Props {
  invitee: Invitee;
  revokeInvite: typeof revokeInvite;
}

class InviteeRow extends PureComponent<Props> {
  private copyUrlRef = createRef<HTMLTextAreaElement>();

  copyToClipboard = () => {
    const node = this.copyUrlRef.current;

    if (node) {
      node.select();
      document.execCommand('copy');
    }
  };

  render() {
    const { invitee, revokeInvite } = this.props;
    return (
      <tr>
        <td>{invitee.email}</td>
        <td>{invitee.name}</td>
        <td className="text-right">
          <button className="btn btn-inverse btn-small" onClick={this.copyToClipboard}>
            <textarea
              readOnly={true}
              value={invitee.url}
              style={{ position: 'absolute', right: -1000 }}
              ref={this.copyUrlRef}
            />
            Copy Invite
          </button>
          &nbsp;
        </td>
        <td>
          <button className="btn btn-danger btn-small" onClick={() => revokeInvite(invitee.code)}>
            <i className="fa fa-remove" />
          </button>
        </td>
      </tr>
    );
  }
}

const mapDispatchToProps = {
  revokeInvite,
};

export default connect(
  () => {
    return {};
  },
  mapDispatchToProps
)(InviteeRow);
