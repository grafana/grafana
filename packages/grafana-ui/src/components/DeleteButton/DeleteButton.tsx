import {  css } from 'emotion';
import styled from '@emotion/styled';

import React, { SyntheticEvent, PureComponent } from 'react';

interface Props {
  onConfirm(): void;
}

interface State {
  showConfirm: boolean;
}

const ConfirmDeleteContainer = styled('span')`
  overflow: hidden;
  width: 145px;
  position: absolute;
  z-index: 1;
`;

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

  getStyles = () => {
    return {
      container: css`
        width: 24px;
        direction: rtl;
        display: flex;
        align-items: center;
        box-shadow: 10px 10px 10px white;
      `,
      deleteButton: css`
        position: absolute;
        opacity: 0;
        transition: opacity 0.1s ease;
        z-index: 0;
      `,
      deleteButtonVisible: css`
        opacity: 1;
        transition: opacity 0.1s ease;
        z-index: 2;
      `,
      confirmDelete: css`
        display: flex;
        align-items: flex-start;
        opacity: 0;
        transition: opacity 0.12s ease-in, transform 0.14s ease-in;
        transform: translateX(100px);
      `,
      confirmDeleteShow: css`
        opacity: 1;
        transition: opacity 0.08s ease-out, transform 0.1s ease-out;
        transform: translateX(0);
      `,
    };
  };

  render() {
    const { onConfirm } = this.props;
    const styles = this.getStyles();

    return (
      <div className={styles.container}>
        <a
          // className={styles.coynfirmDelete}
          onClick={this.onClickDelete}
          data-test-id="deleteButton"
        >
          <i className="fa fa-remove" />
        </a>

        <ConfirmDeleteContainer>
          <span
            css={css`
              ${styles.confirmDelete};
              ${this.state.showConfirm ? styles.confirmDeleteShow : ''};
            `}
          >
            <a className="btn btn-small" onClick={this.onClickCancel} data-test-id="cancelDeleteButton">
              Cancel
            </a>
            <a className="btn btn-danger btn-small" onClick={onConfirm}>
              Confirm Delete
            </a>
          </span>
        </ConfirmDeleteContainer>

      </div>
    );
  }
}
