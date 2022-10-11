import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

import { Button, getPortalContainer, Modal } from '@grafana/ui';

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
      <Modal
        title="Proceed to external site?"
        isOpen={showModal}
        className={css`
          width: max-content;
          max-width: 80vw;
        `}
      >
        <>
          <p>
            {`This link connects to an external website at`} <code>{url}</code>
          </p>
          <p>{"Are you sure you'd like to proceed?"}</p>
          <Modal.ButtonRow>
            <Button
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                onDismiss?.();
              }}
              fill="outline"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowModal(false);
                onConfirm();
              }}
            >
              Proceed
            </Button>
          </Modal.ButtonRow>
        </>
      </Modal>
    );
    ReactDOM.render(theModal, wrapperDiv);

    return () => {
      ReactDOM.unmountComponentAtNode(wrapperDiv);
      portalContainer.removeChild(wrapperDiv);
    };
  }, [url, showModal, onConfirm, onDismiss]);

  return () => setShowModal(true);
}
