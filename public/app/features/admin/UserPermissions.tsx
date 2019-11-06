import React, { PureComponent } from 'react';
import { UserProfileRow, RowAction } from './UserProfileRow';

interface Props {
  isGrafanaAdmin: boolean;

  onGrafanaAdminChange: (isGrafanaAdmin: boolean) => void;
}

export class UserPermissions extends PureComponent<Props> {
  handleGrafanaAdminChange = () => {
    const { isGrafanaAdmin, onGrafanaAdminChange } = this.props;
    onGrafanaAdminChange(!isGrafanaAdmin);
  };

  render() {
    const { isGrafanaAdmin } = this.props;

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
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }
}
