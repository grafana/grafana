import React from 'react';
import { Modal } from '@grafana/ui';
import { QueryModalModel } from './types';
import { DataQuery } from '@grafana/data';

const queryModalModels: Map<string, QueryModalModel> = new Map<string, QueryModalModel>();

export function addQueryModal(key: string, modal: QueryModalModel) {
  queryModalModels.set(key, modal);
}

export interface Props {
  query?: DataQuery;
  isOpen: boolean;
  modalKey: string;
  onDismiss: () => void;
  onAddQuery?: (q: DataQuery) => void;
}

export const QueryModal: React.FC<Props> = ({ query, isOpen, modalKey, onDismiss, onAddQuery }: Props) => {
  let content = queryModalModels.get(modalKey);
  if (!content) {
    return null;
  }

  const { title, body: Body } = content as QueryModalModel;
  return (
    <Modal isOpen={isOpen} title={title} onDismiss={onDismiss}>
      <Body query={query} onAddQuery={onAddQuery} />
    </Modal>
  );
};
