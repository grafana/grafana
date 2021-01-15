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
const getTruncatedString = (input: string, length = 5): string => {
  input = (input || '').trim();
  if (input.length > length) {
    return input.substring(0, length) + '...';
  }
  return input;
};

type ModalViewCellModalDisplayMode = 'html' | 'json' | 'plain_text';
type ModalViewCellFieldDisplayMode = 'truncated_text' | 'button';

interface ModalViewCellProps extends TableCellProps {
  modalDisplayMode: ModalViewCellModalDisplayMode;
  fieldDisplayMode: ModalViewCellFieldDisplayMode;
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
    const { cell, tableStyles } = this.props;
    const modalDisplayMode: ModalViewCellModalDisplayMode = this.props.modalDisplayMode || 'plain_text';
    const fieldDisplayMode: ModalViewCellFieldDisplayMode = this.props.fieldDisplayMode || 'truncated_text';
    const modalTitle = this.props.modalTitle || 'Show';
    let fieldDisplayContent: any;
    switch (fieldDisplayMode) {
      case 'button':
        fieldDisplayContent = (
          <Button className="btn-small" variant="secondary" onClick={() => this.showCellModal(true)}>
            {modalTitle}
          </Button>
        );
        break;
      case 'truncated_text':
      default:
        fieldDisplayContent = (
          <div className={tableStyles.tableCell} onClick={() => this.showCellModal(true)}>
            {getTruncatedString(cell.value || '')}
          </div>
        );
        break;
    }
    const modalContent = this.props.modalContent || cell.value || '';
    let modalDisplayContent: any;
    switch (modalDisplayMode) {
      case 'html':
        modalDisplayContent = <div dangerouslySetInnerHTML={{ __html: modalContent }}></div>;
        break;
      case 'json':
        modalDisplayContent = <JSONFormatter json={getJsonObjectFromString(cell.value)} open={4} />;
        break;
      case 'plain_text':
      default:
        modalDisplayContent = <div>{cell.value}</div>;
    }
    return (
      <div>
        <div>{fieldDisplayContent}</div>
        <Modal
          title={modalTitle || 'Details'}
          isOpen={this.state.showCellModal}
          onDismiss={() => this.showCellModal(false)}
        >
          {modalDisplayContent}
        </Modal>
      </div>
    );
  }
}
