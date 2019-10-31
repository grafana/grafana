import React, { PureComponent } from 'react';
import { UserProfileRow, RowAction } from './UserProfileRow';

interface Props {
  isGrafanaAdmin: boolean;
  isDisabled: boolean;

  onGrafanaAdminChange: (isGrafanaAdmin: boolean) => void;
  onStatusChange: (isDisabled: boolean) => void;
}

export class UserPermissions extends PureComponent<Props> {
  handleGrafanaAdminChange = () => {
    const { isGrafanaAdmin, onGrafanaAdminChange } = this.props;
    onGrafanaAdminChange(!isGrafanaAdmin);
  };

  handleStatusChange = () => {
    const { isDisabled, onStatusChange } = this.props;
    onStatusChange(!isDisabled);
  };

  render() {
    const { isGrafanaAdmin, isDisabled } = this.props;

    return (
      <>
        <h3 className="page-heading">Permissions</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <tbody>
                <UserProfileRow label="Grafana Admin">
                  <>
                    <td colSpan={2}>
                      {isGrafanaAdmin ? (
                        <>
                          <i className="gicon gicon-shield" /> Yes
                        </>
                      ) : (
                        <>No</>
                      )}
                    </td>
                    <td>
                      <RowAction text="Change" onClick={this.handleGrafanaAdminChange} />
                    </td>
                  </>
                </UserProfileRow>
                <UserProfileRow label="Status">
                  <td colSpan={2}>
                    {isDisabled ? (
                      <>
                        <i className="fa fa-fw fa-times" /> Inactive
                      </>
                    ) : (
                      <>
                        <i className="fa fa-fw fa-check" /> Active
                      </>
                    )}
                  </td>
                </UserProfileRow>
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }
}
