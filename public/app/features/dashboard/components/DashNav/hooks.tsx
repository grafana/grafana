import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

import { ConfirmModal, getPortalContainer } from '@grafana/ui';

export function useModal({
  url,
  onConfirm,
  onDismiss,
}: {
  url: string;
  onConfirm: () => void;
  onDismiss?: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const portalContainer = getPortalContainer();
    if (!showModal) {
      return;
    }

    const wrapperDiv = document.createElement('div');
    portalContainer.appendChild(wrapperDiv);
    const theModal = (
      <ConfirmModal
        isOpen={showModal}
        title="Proceed to external site?"
        modalClass={css`
          width: max-content;
          max-width: 80vw;
        `}
        body={
          <>
            <p>
              {`This link connects to an external website at`} <code>{url}</code>.
            </p>
            <p>{"Are you sure you'd like to proceed?"}</p>
          </>
        }
        dismissVariant="secondary"
        dismissText="Cancel"
        confirmVariant="primary"
        confirmText="Proceed"
        onConfirm={() => {
          setShowModal(false);
          onConfirm();
        }}
        onDismiss={() => {
          setShowModal(false);
          onDismiss?.();
        }}
      />
    );

    ReactDOM.render(theModal, wrapperDiv);

    return () => {
      ReactDOM.unmountComponentAtNode(wrapperDiv);
      portalContainer.removeChild(wrapperDiv);
    };
  }, [url, showModal, onConfirm, onDismiss]);

  return () => setShowModal(true);
}
