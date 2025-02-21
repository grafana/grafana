import { css } from '@emotion/css';
import history from 'history';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom-v5-compat';

import { Button, Modal } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { Prompt } from './Prompt';

export interface Props {
  confirmRedirect?: boolean;
  onDiscard: () => void;
  /** Extra check to invoke when location changes.
   * Could be useful in multistep forms where each step has a separate URL
   */
  onLocationChange?: (location: history.Location) => void;
}

/**
 * Component handling redirects when a form has unsaved changes.
 * Page reloads are handled in useEffect via beforeunload event.
 * URL navigation is handled by react-router's components since it does not trigger beforeunload event.
 */
export const FormPrompt = ({ confirmRedirect, onDiscard, onLocationChange }: Props) => {
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [blockedLocation, setBlockedLocation] = useState<history.Location | null>(null);
  const [changesDiscarded, setChangesDiscarded] = useState(false);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (confirmRedirect) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [confirmRedirect]);

  // Returning 'false' from this function will prevent navigation to the next URL
  const handleRedirect = (location: history.Location) => {
    // Do not show the unsaved changes modal if only the URL params have changed
    const currentPath = window.location.pathname;
    const nextPath = location.pathname;
    if (currentPath === nextPath) {
      return true;
    }

    const locationChangeCheck = onLocationChange?.(location);

    let blockRedirect = confirmRedirect && !changesDiscarded;
    if (locationChangeCheck !== undefined) {
      blockRedirect = blockRedirect && locationChangeCheck;
    }

    if (blockRedirect) {
      setModalIsOpen(true);
      setBlockedLocation(location);
      return false;
    }

    if (locationChangeCheck) {
      onDiscard();
    }

    return true;
  };

  const onBackToForm = () => {
    setModalIsOpen(false);
    setBlockedLocation(null);
  };

  const onDiscardChanges = () => {
    setModalIsOpen(false);
    setChangesDiscarded(true);
    onDiscard();
  };

  return (
    <>
      <Prompt when={true} message={handleRedirect} />
      {blockedLocation && changesDiscarded && <Navigate replace to={blockedLocation} />}
      <UnsavedChangesModal isOpen={modalIsOpen} onDiscard={onDiscardChanges} onBackToForm={onBackToForm} />
    </>
  );
};

interface UnsavedChangesModalProps {
  onDiscard: () => void;
  onBackToForm: () => void;
  isOpen: boolean;
}

const UnsavedChangesModal = ({ onDiscard, onBackToForm, isOpen }: UnsavedChangesModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      title="Leave page?"
      onDismiss={onBackToForm}
      icon="exclamation-triangle"
      className={css({ width: '500px' })}
    >
      <h5>
        <Trans i18nKey="form-prompt.description">Changes that you made may not be saved.</Trans>
      </h5>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onBackToForm} fill="outline">
          <Trans i18nKey="form-prompt.continue-button">Continue editing</Trans>
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          <Trans i18nKey="form-prompt.discard-button">Discard unsaved changes</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
