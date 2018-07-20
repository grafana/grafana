import React, { Component } from 'react';

export default class DeleteButton extends Component<any, any> {
  state = {
    deleteButton: 'delete-button--show',
    confirmSpan: 'confirm-delete--removed',
  };

  handleDelete = event => {
    if (event) {
      event.preventDefault();
    }

    this.setState({
      deleteButton: 'delete-button--hide',
    });

    setTimeout(() => {
      this.setState({
        deleteButton: 'delete-button--removed',
      });
    }, 100);

    setTimeout(() => {
      this.setState({
        confirmSpan: 'confirm-delete--hide',
      });
    }, 100);

    setTimeout(() => {
      this.setState({
        confirmSpan: 'confirm-delete--show',
      });
    }, 150);
  };

  cancelDelete = event => {
    event.preventDefault();

    this.setState({
      confirmSpan: 'confirm-delete--hide',
    });

    setTimeout(() => {
      this.setState({
        confirmSpan: 'confirm-delete--removed',
        deleteButton: 'delete-button--hide',
      });
    }, 140);

    setTimeout(() => {
      this.setState({
        deleteButton: 'delete-button--show',
      });
    }, 190);
  };

  render() {
    const { confirmDelete } = this.props;
    return (
      <span className="delete-button-container">
        <a className={this.state.deleteButton + ' btn btn-danger btn-small'} onClick={this.handleDelete}>
          <i className="fa fa-remove" />
        </a>
        <span className="confirm-delete-container">
          <span className={this.state.confirmSpan}>
            <a className="btn btn-small" onClick={this.cancelDelete}>
              Cancel
            </a>
            <a className="btn btn-danger btn-small" onClick={confirmDelete}>
              Confirm Delete
            </a>
          </span>
        </span>
      </span>
    );
  }
}
