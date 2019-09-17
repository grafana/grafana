import React, { PureComponent, FC } from 'react';
import { css } from 'emotion';
import { dateTime } from '@grafana/data';
import { UserDTO, UserOrg } from 'app/types';

const defaultTimeFormat = 'dddd YYYY-MM-DD HH:mm:ss';

interface Props {
  user: UserDTO;
  orgs: UserOrg[];
}

interface State {
  isLoading: boolean;
}

export class UserProfile extends PureComponent<Props, State> {
  render() {
    const { user, orgs } = this.props;
    const updateTime = dateTime(user.updatedAt).format(defaultTimeFormat);

    return (
      <>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <tbody>
                <UserProfileRow label="Username" value={user.login} />
                <UserProfileRow label="Name" value={user.name} />
                <EditableRow label="Email" value={user.email} editButton />
                <UserProfileRow label="Profile Picture">
                  <>
                    <td colSpan={2}>
                      <img className="filter-table__avatar" src={user.avatarUrl} />
                    </td>
                    <td>Visit user's preferences page to change avatar</td>
                  </>
                </UserProfileRow>
                <UserProfileRow label="Updated" value={updateTime} />
              </tbody>
            </table>
          </div>
        </div>

        <h3 className="page-heading">Permissions</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <tbody>
                <UserProfileRow label="Status">
                  <td colSpan={2}>
                    {user.isDisabled ? (
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
                <UserProfileRow label="Grafana Admin">
                  <td colSpan={2}>
                    {user.isGrafanaAdmin ? (
                      <>
                        <i className="gicon gicon-shield" /> Yes
                      </>
                    ) : (
                      <>No</>
                    )}
                  </td>
                </UserProfileRow>
              </tbody>
            </table>
          </div>
        </div>

        <h3 className="page-heading">Organizations</h3>
        <div className="gf-form-group">
          <div className="gf-form">
            <table className="filter-table form-inline">
              <tbody>
                {orgs.map((org, index) => (
                  <UserProfileRow key={`${org.orgId}-${index}`} label={org.name} value={org.role} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }
}

const labelStyle = css`
  font-weight: 500;
`;

interface UserProfileRowProps {
  label: string;
  value?: any;
  editable?: boolean;
  children?: JSX.Element;
}

export const UserProfileRow: FC<UserProfileRowProps> = ({ label, value, editable, children }) => {
  return (
    <tr>
      <td className={`width-16 ${labelStyle}`}>{label}</td>
      {value && (
        <td className="width-25" colSpan={2}>
          {value}
        </td>
      )}
      {children || <td />}
    </tr>
  );
};

interface EditableRowProps {
  label: string;
  value?: string;
  editButton?: boolean;
  onChange?: (value: string) => void;
}

interface EditableRowState {
  editing: boolean;
}

export class EditableRow extends PureComponent<EditableRowProps, EditableRowState> {
  inputElem: HTMLInputElement;

  state = {
    editing: false,
  };

  handleEdit = () => {
    this.setState({ editing: true }, this.focusInput);
  };

  handleEditButtonClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (this.state.editing) {
      return;
    }
    this.setState({ editing: true }, this.focusInput);
  };

  handleInputBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    this.setState({ editing: false });
    if (this.props.onChange) {
      const newValue = event.target.value;
      this.props.onChange(newValue);
    }
  };

  focusInput = () => {
    this.inputElem.focus();
  };

  render() {
    const { label, value, editButton } = this.props;

    return (
      <tr>
        <td className={`width-16 ${labelStyle}`}>{label}</td>
        <td className="width-25" colSpan={2}>
          {this.state.editing ? (
            <input
              defaultValue={value}
              ref={elem => {
                this.inputElem = elem;
              }}
              onBlur={this.handleInputBlur}
            />
          ) : (
            <span onClick={this.handleEdit}>{value}</span>
          )}
        </td>
        {editButton && (
          <td>
            <button className="btn btn-primary btn-small" onMouseDown={this.handleEditButtonClick}>
              <i className="fa fa-pencil" />
            </button>
          </td>
        )}
      </tr>
    );
  }
}
