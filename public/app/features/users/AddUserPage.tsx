import React, { PureComponent } from 'react';
import RadioButton from 'app/core/components/RadioButton/RadioButton';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel, StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import PageHeader from 'app/core/components/PageHeader/PageHeader';

export interface Props {
  navModel: NavModel;
}

export interface State {
  onNewUser: boolean;
  onByInvite: boolean;
}

export class AddUserPage extends PureComponent<Props, State> {
  constructor(props) {
    super(props);
    this.state = { onNewUser: true, onByInvite: true };
  }

  onNewUser() {
    this.setState({ onNewUser: true });
  }

  onGetUser() {
    this.setState({ onNewUser: false });
  }

  onViaMail() {
    this.setState({ onByInvite: true });
  }

  onCreate() {
    this.setState({ onByInvite: false });
  }

  renderGetUser() {
    return (
      <div className="gf-form-group">
        <div className="gf-form max-width-30">
          <span className="gf-form-label width-10">Email or Username</span>
          <input
            type="text"
            ng-model="ctrl.invite.loginOrEmail"
            required
            className="gf-form-input"
            placeholder="email@test.com"
          />
        </div>
        <div className="gf-form max-width-30">
          <span className="gf-form-label width-10">Role</span>
          <select
            ng-model="ctrl.invite.role"
            className="gf-form-input"
            ng-options="f for f in ['Viewer', 'Editor', 'Admin']"
          />
        </div>
      </div>
    );
  }

  renderNewUser() {
    let createManually;
    if (!this.state.onByInvite) {
      createManually = this.renderCreateManually();
    }
    return (
      <div>
        <div className="gf-form-group">
          <div className="gf-form max-width-30">
            <span className="gf-form-label width-10">Email</span>
            <input
              type="text"
              ng-model="ctrl.invite.loginOrEmail"
              required
              className="gf-form-input"
              placeholder="email@test.com"
            />
          </div>
          <div className="gf-form max-width-30">
            <span className="gf-form-label width-10">Role</span>
            <select
              ng-model="ctrl.invite.role"
              className="gf-form-input"
              ng-options="f for f in ['Viewer', 'Editor', 'Admin']"
            />
          </div>
        </div>
        <div className="gf-form-group">
          <RadioButton
            radioName={'invite-create'}
            radioLabel={'Via invite'}
            radioFunction={() => this.onViaMail()}
            checked={true}
          />
          <RadioButton
            radioName={'invite-create'}
            radioLabel={'Create manually'}
            radioFunction={() => this.onCreate()}
          />
        </div>
        {createManually}
      </div>
    );
  }

  renderCreateManually() {
    return (
      <div className="gf-form-group">
        <div className="gf-form max-width-30" ng-if="ctrl.create">
          <span className="gf-form-label width-10">Username</span>
          <input
            type="text"
            ng-model="ctrl.invite.loginOrEmail"
            required
            className="gf-form-input"
            placeholder="username"
          />
        </div>
        <div className="gf-form max-width-30" ng-if="ctrl.create">
          <span className="gf-form-label width-10">Name</span>
          <input type="text" ng-model="ctrl.invite.name" className="gf-form-input" placeholder="name (optional)" />
        </div>
        <div className="gf-form max-width-30" ng-if="ctrl.create">
          <span className="gf-form-label width-10">Password</span>
          <input type="text" ng-model="ctrl.invite.name" className="gf-form-input" placeholder="" />
        </div>
      </div>
    );
  }

  render() {
    let form;
    const { navModel } = this.props;
    if (this.state.onNewUser) {
      form = this.renderNewUser();
    } else {
      form = this.renderGetUser();
    }
    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <div className="gf-form-group">
            <RadioButton
              radioName={'new-get-user'}
              radioLabel={'New user'}
              radioFunction={() => this.onNewUser()}
              checked={true}
            />
            <RadioButton
              radioName={'new-get-user'}
              radioLabel={'Get user from other org'}
              radioFunction={() => this.onGetUser()}
            />
          </div>
          {form}
          <div className="gf-form-button-row">
            <button type="submit" className="btn btn-success">
              Add
            </button>
            <a className="btn" href="org/users">
              Back
            </a>
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'users'),
});

export default hot(module)(connect(mapStateToProps)(AddUserPage));
