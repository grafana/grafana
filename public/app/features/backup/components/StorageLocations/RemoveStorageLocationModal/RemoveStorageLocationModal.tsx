import { DeleteModal } from 'app/features/integrated-alerting/components/DeleteModal';
import React, { FC } from 'react';
import { WarningBlock } from '../WarningBlock/WarningBlock';
import { Messages } from './RemoveStorageLocationModal.messages';
import { RemoveStorageLocationModalProps } from './RemoveStorageLocationModal.types';

export const RemoveStorageLocationModal: FC<RemoveStorageLocationModalProps> = ({
  location,
  isVisible,
  loading,
  onDelete,
  setVisible,
}) => {
  const handleDelete = () => onDelete(location);
  return (
    <DeleteModal
      title={Messages.title}
      loading={loading}
      isVisible={isVisible}
      setVisible={setVisible}
      message={Messages.getDeleteMessage(location?.name || '')}
      onDelete={handleDelete}
    >
      <WarningBlock message={Messages.deleteLocationWarning} />
    </DeleteModal>
  );
};
