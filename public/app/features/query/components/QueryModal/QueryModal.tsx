import React from 'react';
import { Modal } from '@grafana/ui';
import { QueryModalModel } from './types';
import { DataQuery } from '@grafana/data';

const content: Map<string, QueryModalModel> = new Map<string, QueryModalModel>();

export function addQueryModal(key: string, modal: QueryModalModel) {
  content.set(key, modal);
}

interface Props {
  query: DataQuery;
  isOpen: boolean;
  modalKey: string;
  onDismiss: () => void;
  onAddQuery?: (q: DataQuery) => void;
}

export const QueryModal: React.FC<Props> = ({ query, isOpen, modalKey, onDismiss, onAddQuery }: Props) => {
  const { title, body: Body } = content.get(modalKey) as QueryModalModel;

  return (
    <Modal isOpen={isOpen} title={title} onDismiss={onDismiss}>
      <Body query={query} onAddQuery={onAddQuery} />
    </Modal>
  );
};
