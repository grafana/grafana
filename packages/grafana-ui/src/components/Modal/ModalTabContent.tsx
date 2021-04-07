import React from 'react';
import { IconName } from '../../types';

interface Props {
  /** @deprecated */
  icon?: IconName;
  /** @deprecated */
  iconClass?: string;
}

/** @internal */
export const ModalTabContent: React.FC<Props> = ({ children }) => {
  return (
    <div className="share-modal-body">
      <div className="share-modal-header">
        <div className="share-modal-content">{children}</div>
      </div>
    </div>
  );
};
