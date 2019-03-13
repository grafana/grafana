import React, { PureComponent, SyntheticEvent } from 'react';

interface Props {
  onConfirm(): void;
  disabled?: boolean;
}

interface State {
  showConfirm: boolean;
}

export class DeleteButton extends PureComponent<Props, State> {
  state: State = {
    showConfirm: false,
  };

  onClickDelete = (event: SyntheticEvent) => {
    if (event) {
      event.preventDefault();
    }

    this.setState({
      showConfirm: true,
    });
  };

  onClickCancel = (event: SyntheticEvent) => {
    if (event) {
      event.preventDefault();
    }
    this.setState({
      showConfirm: false,
    });
  };

  render() {
    const { onConfirm, disabled } = this.props;
    const showConfirmClass = this.state.showConfirm ? 'show' : 'hide';
    const showDeleteButtonClass = this.state.showConfirm ? 'hide' : 'show';
    const disabledClass = disabled ? 'disabled btn-inverse' : '';
    const onClick = disabled ? () => {} : this.onClickDelete;

    return (
      <span className="delete-button-container">
        <a
          className={`delete-button ${showDeleteButtonClass} btn btn-danger btn-small ${disabledClass}`}
          onClick={onClick}
        >
          <i className="fa fa-remove" />
        </a>
        <span className="confirm-delete-container">
          <span className={`confirm-delete ${showConfirmClass}`}>
            <a className="btn btn-small" onClick={this.onClickCancel}>
              Cancel
            </a>
            <a className="btn btn-danger btn-small" onClick={onConfirm}>
              Confirm Delete
            </a>
          </span>
        </span>
      </span>
    );
  }
}
