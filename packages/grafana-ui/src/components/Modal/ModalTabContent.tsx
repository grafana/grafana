import React from 'react';

/** @internal */
export const ModalTabContent: React.FC = ({ children }) => {
  return (
    <div className="share-modal-body">
      <div className="share-modal-header">
        <div className="share-modal-content">{children}</div>
      </div>
    </div>
  );
};
