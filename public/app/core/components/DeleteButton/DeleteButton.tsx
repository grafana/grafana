import React, { PureComponent } from 'react';

export interface DeleteButtonProps {
  onConfirmDelete();
}

export interface DeleteButtonStates {
  showConfirm: boolean;
}

export default class DeleteButton extends PureComponent<DeleteButtonProps, DeleteButtonStates> {
  state: DeleteButtonStates = {
    showConfirm: false,
  };

  onClickDelete = event => {
    if (event) {
      event.preventDefault();
    }

    this.setState({
      showConfirm: true,
    });
  };

  onClickCancel = event => {
    if (event) {
      event.preventDefault();
    }
    this.setState({
      showConfirm: false,
    });
  };

  render() {
    const onClickConfirm = this.props.onConfirmDelete;
    let showConfirm;
    let showDeleteButton;

    if (this.state.showConfirm) {
      showConfirm = 'show';
      showDeleteButton = 'hide';
    } else {
      showConfirm = 'hide';
      showDeleteButton = 'show';
    }

    return (
      <span className="delete-button-container">
        <a className={'delete-button ' + showDeleteButton + ' btn btn-danger btn-small'} onClick={this.onClickDelete}>
          <i className="fa fa-remove" />
        </a>
        <span className="confirm-delete-container">
          <span className={'confirm-delete ' + showConfirm}>
            <a className="btn btn-small" onClick={this.onClickCancel}>
              Cancel
            </a>
            <a className="btn btn-danger btn-small" onClick={onClickConfirm}>
              Confirm Delete
            </a>
          </span>
        </span>
      </span>
    );
  }
}
