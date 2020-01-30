import React, { PureComponent } from 'react';
import { ConfirmButton } from '@grafana/ui';
import { cx } from 'emotion';

interface Props {
  isGrafanaAdmin: boolean;

  onGrafanaAdminChange: (isGrafanaAdmin: boolean) => void;
}

interface State {
  isEditing: boolean;
  currentAdminOption: string;
}

export class UserPermissions extends PureComponent<Props, State> {
  state = {
    isEditing: false,
    currentAdminOption: this.props.isGrafanaAdmin ? 'YES' : 'NO',
  };

  onChangeClick = () => {
    this.setState({ isEditing: true });
  };

  onCancelClick = () => {
    this.setState({
      isEditing: false,
      currentAdminOption: this.props.isGrafanaAdmin ? 'YES' : 'NO',
    });
  };

  onGrafanaAdminChange = () => {
    const { currentAdminOption } = this.state;
    const newIsGrafanaAdmin = currentAdminOption === 'YES' ? true : false;
    this.props.onGrafanaAdminChange(newIsGrafanaAdmin);
  };

  onAdminOptionSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ currentAdminOption: event.target.value });
  };

  render() {
    const { isGrafanaAdmin } = this.props;
    const { isEditing, currentAdminOption } = this.state;
    const changeButtonContainerClass = cx('pull-right');

    return (
      <>
        <h3 className="page-heading">Permissions</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <tbody>
                <tr>
                  <td className="width-16">Grafana Admin</td>
                  {isEditing ? (
                    <td colSpan={2}>
                      <div className="gf-form-select-wrapper width-8">
                        <select
                          value={currentAdminOption}
                          className="gf-form-input"
                          onChange={this.onAdminOptionSelect}
                        >
                          {['YES', 'NO'].map((option, index) => {
                            return (
                              <option value={option} key={`${option}-${index}`}>
                                {option}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </td>
                  ) : (
                    <td colSpan={2}>
                      {isGrafanaAdmin ? (
                        <>
                          <i className="gicon gicon-shield" /> Yes
                        </>
                      ) : (
                        <>No</>
                      )}
                    </td>
                  )}
                  <td>
                    <div className={changeButtonContainerClass}>
                      <ConfirmButton
                        className="pull-right"
                        onClick={this.onChangeClick}
                        onConfirm={this.onGrafanaAdminChange}
                        onCancel={this.onCancelClick}
                        confirmText="Change"
                      >
                        Change
                      </ConfirmButton>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }
}
