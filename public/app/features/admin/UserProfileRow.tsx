import React, { PureComponent, FC, useContext } from 'react';
import { css, cx } from 'emotion';
import { ThemeContext } from '@grafana/ui';

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

  handleEditClick = (event: React.MouseEvent) => {
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
    const { label, value } = this.props;

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
        <td>
          <RowAction text="Edit" onClick={this.handleEditClick} />
        </td>
      </tr>
    );
  }
}

export interface RowActionProps {
  text: string;
  onClick: (event: React.MouseEvent) => void;
}

export const RowAction: FC<RowActionProps> = (props: RowActionProps) => {
  const { onClick, text } = props;
  const theme = useContext(ThemeContext);
  const actionClass = cx(
    'pull-right',
    css`
      margin-right: 0.6rem;
      text-decoration: underline;
      color: ${theme.colors.blue95};
    `
  );

  return (
    <a type="button" onMouseDown={onClick} className={actionClass}>
      {text}
    </a>
  );
};
