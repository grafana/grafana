import React, { PureComponent } from 'react';
import { ConfirmButton, RadioButtonGroup, Icon } from '@grafana/ui';
import { cx } from 'emotion';

interface Props {
  isGrafanaAdmin: boolean;

  onGrafanaAdminChange: (isGrafanaAdmin: boolean) => void;
}

interface State {
  isEditing: boolean;
  currentAdminOption: string;
}

const adminOptions = [
  { label: 'Yes', value: 'YES' },
  { label: 'No', value: 'NO' },
];

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

  onAdminOptionSelect = (value: string) => {
    this.setState({ currentAdminOption: value });
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
                      <RadioButtonGroup
                        options={adminOptions}
                        value={currentAdminOption}
                        onChange={this.onAdminOptionSelect}
                      />
                    </td>
                  ) : (
                    <td colSpan={2}>
                      {isGrafanaAdmin ? (
                        <>
                          <Icon name="shield" /> Yes
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
