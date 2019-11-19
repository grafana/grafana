import React, { PureComponent } from 'react';
import { ConfirmButton } from '@grafana/ui';
import { cx, css } from 'emotion';

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

  handleChangeClick = () => {
    this.setState({ isEditing: true });
  };

  handleCancelClick = () => {
    this.setState({
      isEditing: false,
      currentAdminOption: this.props.isGrafanaAdmin ? 'YES' : 'NO',
    });
  };

  handleGrafanaAdminChange = () => {
    const { currentAdminOption } = this.state;
    const newIsGrafanaAdmin = currentAdminOption === 'YES' ? true : false;
    this.props.onGrafanaAdminChange(newIsGrafanaAdmin);
  };

  handleAdminOptionSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ currentAdminOption: event.target.value });
  };

  render() {
    const { isGrafanaAdmin } = this.props;
    const { isEditing, currentAdminOption } = this.state;
    const changeButtonContainerClass = cx(
      'pull-right',
      css`
        margin-right: 0.6rem;
      `
    );

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
                          onChange={this.handleAdminOptionSelect}
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
                        onClick={this.handleChangeClick}
                        onConfirm={this.handleGrafanaAdminChange}
                        onCancel={this.handleCancelClick}
                        buttonText="Change"
                        confirmText="Change"
                      />
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
