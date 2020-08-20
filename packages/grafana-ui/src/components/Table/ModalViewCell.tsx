import React, { PureComponent } from 'react';
import { Modal } from './../Modal/Modal';
import { TableCellProps } from './types';
import { Button } from '../Button';
import { JSONFormatter } from '../JSONFormatter/JSONFormatter';

const getJsonObjectFromString = (input: any): any => {
  let output: any = JSON.stringify(input || '');
  try {
    output = JSON.parse(input);
  } catch {} // ignore errors
  return output;
};

type ModalViewCellDisplayMode = 'html' | 'json' | 'plain_text';

interface ModalViewCellProps extends TableCellProps {
  displayMode: ModalViewCellDisplayMode;
  modalTitle: string;
  modalContent: string;
}

interface State {
  showCellModal: boolean;
}

export class ModalViewCell extends PureComponent<ModalViewCellProps, State> {
  state = {
    showCellModal: false,
  };
  showCellModal(show: boolean) {
    this.setState({ showCellModal: show });
  }
  render() {
    const { cell } = this.props;
    const displayMode: ModalViewCellDisplayMode = this.props.displayMode || 'plain_text';
    const modalTitle = this.props.modalTitle || 'Show';
    const modalContent = this.props.modalContent || cell.value || '';
    let displayContent: any;
    switch (displayMode) {
      case 'html':
        displayContent = <div dangerouslySetInnerHTML={{ __html: modalContent }}></div>;
        break;
      case 'json':
        displayContent = <JSONFormatter json={getJsonObjectFromString(cell.value)} open={4} />;
        break;
      case 'plain_text':
      default:
        displayContent = <div>{cell.value}</div>;
    }
    return (
      <div>
        <div>
          <Button className="btn-small" variant="secondary" onClick={() => this.showCellModal(true)}>
            {modalTitle}
          </Button>
        </div>
        <Modal
          title={modalTitle || 'Details'}
          isOpen={this.state.showCellModal}
          onDismiss={() => this.showCellModal(false)}
        >
          {displayContent}
        </Modal>
      </div>
    );
  }
}
