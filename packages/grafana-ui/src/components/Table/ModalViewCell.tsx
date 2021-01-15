import React, { PureComponent } from 'react';
import { Modal } from './../Modal/Modal';
import { TableCellProps } from './types';
import { Button } from '../Button';

interface State {
  showHelpModal: boolean;
}
export class ModalViewCell extends PureComponent<TableCellProps, State> {
  state = {
    showHelpModal: false,
  };
  showHelpModal(show: boolean) {
    this.setState({ showHelpModal: show });
  }
  render() {
    const { cell } = this.props;
    return (
      <div>
        <div>
          <Button className="btn-small" variant="secondary" onClick={() => this.showHelpModal(true)}>
            Show
          </Button>
        </div>
        <Modal title="More details" isOpen={this.state.showHelpModal} onDismiss={() => this.showHelpModal(false)}>
          <div>{cell.value}</div>
        </Modal>
      </div>
    );
  }
}
