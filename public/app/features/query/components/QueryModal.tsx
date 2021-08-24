import React from 'react';
import { Modal } from '@grafana/ui';
import { DataQuery } from '@grafana/data';

const content: Map<string, QueryModalModel> = new Map<string, QueryModalModel>();
export interface QueryModalModel {
  title: string;
  body: QueryModalBody;
}

export function addQueryModal(key: string, modal: QueryModalModel) {
  content.set(key, modal);
}

export interface QueryModalBodyProps {
  query: DataQuery;
  onAddQuery?: (q: DataQuery) => void;
}

export type QueryModalBody = React.ComponentType<QueryModalBodyProps>;

interface QueryModalProps {
  query: DataQuery;
  isOpen: boolean;
  modalKey: string;
  onDismiss: () => void;
  onAddQuery?: (q: DataQuery) => void;
}

export const QueryModal: React.FC<QueryModalProps> = ({
  query,
  isOpen,
  modalKey,
  onDismiss,
  onAddQuery,
}: QueryModalProps) => {
  const { title, body: Body } = content.get(modalKey) as QueryModalModel;

  return (
    <Modal isOpen={isOpen} title={title} onDismiss={onDismiss}>
      <Body query={query} onAddQuery={onAddQuery} />
    </Modal>
  );
};
