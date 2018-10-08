import React, { PureComponent } from 'react';
import { connect } from 'react-redux';

export interface Props {}

export class DataSourcePermissions extends PureComponent<Props> {
  render() {
    return (
      <div>
        <h3>Permissions</h3>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {};
}

export default connect(mapStateToProps)(DataSourcePermissions);
