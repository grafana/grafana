import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';
import UserProfile from './UserProfile';
import { setIsAdmin } from './state/actions';

export interface Props {
  admin: string;
  setIsAdmin: typeof setIsAdmin;
}

export class UserAccount extends PureComponent<Props> {
  constructor(props) {
    super(props);

    this.props.setIsAdmin(props.admin === 'true');
  }

  render() {
    const isLoading = false;
    return (
      <>
        <Page.Contents isLoading={isLoading}>{!isLoading && <UserProfile />}</Page.Contents>
      </>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {};
}

const mapDispatchToProps = {
  setIsAdmin,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserAccount)
);
