import React, { FC } from 'react';

import { DeleteModal } from 'app/percona/shared/components/Elements/DeleteModal';

import { WarningBlock } from '../../../../shared/components/Elements/WarningBlock/WarningBlock';

import { Messages } from './RemoveStorageLocationModal.messages';
import { RemoveStorageLocationModalProps } from './RemoveStorageLocationModal.types';

export const RemoveStorageLocationModal: FC<React.PropsWithChildren<RemoveStorageLocationModalProps>> = ({
  location,
  isVisible,
  loading,
  onDelete,
  setVisible,
}) => {
  const handleDelete = (force = false) => onDelete(location, force);

  return (
    <DeleteModal
      title={Messages.title}
      loading={loading}
      isVisible={isVisible}
      setVisible={setVisible}
      message={Messages.getDeleteMessage(location?.name || '')}
      onDelete={handleDelete}
      showForce
    >
      <WarningBlock message={Messages.deleteLocationWarning} />
    </DeleteModal>
  );
};
