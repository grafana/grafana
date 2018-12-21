import React, { PureComponent } from 'react';

interface Props {
  onConfirm();
}

interface State {
  showConfirm: boolean;
}

export class DeleteButton extends PureComponent<Props, State> {
  state: State = {
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
    const { onConfirm } = this.props;
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
            <a className="btn btn-danger btn-small" onClick={onConfirm}>
              Confirm Delete
            </a>
          </span>
        </span>
      </span>
    );
  }
}
