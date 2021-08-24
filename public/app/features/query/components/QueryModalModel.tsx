import { Modal, Props as ModalProps } from '@grafana/ui/src/components/Modal/Modal';
import React, { PureComponent } from 'react';

export interface Props {
  modal: ModalProps;
}

export interface State {}

export class QueryModalModel extends PureComponent<Props, State> {
  render() {
    return (
      <>
        <Modal title="hello">
          <p>inside</p>
        </Modal>
      </>
    );
  }
}
