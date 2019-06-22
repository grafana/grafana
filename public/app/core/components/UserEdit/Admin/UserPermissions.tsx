import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { OrgUser, StoreState } from 'app/types';
import { updateUserPermissions } from '../state/actions';
import { Button, Switch } from '@grafana/ui';

export interface Props {
  userId: number;
  user: OrgUser;
  updateUserPermissions: typeof updateUserPermissions;
}

export interface State {
  isGrafanaAdmin: boolean;
}

export class UserPermissions extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { user } = props;
    this.state = {
      isGrafanaAdmin: user.isGrafanaAdmin,
    };
  }

  onIsGrafanaAdminChange = () => {
    this.setState({
      isGrafanaAdmin: !this.state.isGrafanaAdmin,
    });
  };

  onUpdatePermissions = () => {
    const { userId } = this.props;
    const { isGrafanaAdmin } = this.state;
    this.props.updateUserPermissions(
      {
        isGrafanaAdmin,
      },
      userId
    );
  };

  render() {
    const { isGrafanaAdmin } = this.state;
    return (
      <>
        <h3 className="page-sub-heading">Permissions</h3>
        <form name="profileForm" className="gf-form-group">
          <Switch label="Grafana Admin" onChange={() => this.onIsGrafanaAdminChange()} checked={isGrafanaAdmin} />
          <div className="gf-form-button-row">
            <Button
              onClick={event => {
                event.preventDefault();
                this.onUpdatePermissions();
              }}
            >
              Save
            </Button>
          </div>
        </form>
      </>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    user: state.user.profile,
  };
}

const mapDispatchToProps = {
  updateUserPermissions,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserPermissions)
);
