import React, { useState, useEffect, useRef } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';
import { changingPasswordTutorial } from 'app/features/tutorial/tutorials/changing-password';
import { StoreState, useDispatch } from 'app/types';

import { TutorialOverlay } from './TutorialOverlay';
import { TUTORIAL_EXIT_EVENT } from './constants';
import { addTutorial, exitCurrentTutorial, startTutorial } from './slice';

const TutorialProviderComponent = ({ currentTutorialId }: ConnectedProps<typeof connector>) => {
  const dispatch = useDispatch();
  const keyupUseDismissedIssue = useRef(false);
  const [showExitTutorialModal, setShowExitTutorialModal] = useState(false);
  const { search } = useLocation();

  useEffect(() => {
    if (!currentTutorialId) {
      setShowExitTutorialModal(false);
    }
  }, [currentTutorialId]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tutorialId = params.get('startTutorial');

    if (tutorialId) {
      locationService.replace({ search: `` });
      dispatch(addTutorial(changingPasswordTutorial));
      dispatch(startTutorial(changingPasswordTutorial.id));
    }
  }, [dispatch, search]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !keyupUseDismissedIssue.current) {
        setShowExitTutorialModal(true);
        keyupUseDismissedIssue.current = false;
      }
    };

    // TODO: why doesn't this work on keydown?
    window.addEventListener('keyup', handler);

    return () => {
      window.removeEventListener('keyup', handler);
    };
  }, []);

  if (currentTutorialId) {
    return (
      <>
        <TutorialOverlay modalOpen={showExitTutorialModal} />
        <ConfirmModal
          confirmText="Stop tutorial"
          onDismiss={() => {
            keyupUseDismissedIssue.current = true;
            setShowExitTutorialModal(false);
            setTimeout(() => {
              keyupUseDismissedIssue.current = false;
            }, 300);
          }}
          isOpen={showExitTutorialModal}
          title={`Exit tutorial`}
          body={`Do you want to stop the tutorial?`}
          onConfirm={() =>
            new Promise((resolve) => {
              dispatch(exitCurrentTutorial());
              resolve();
              setShowExitTutorialModal(false);
              document.dispatchEvent(new CustomEvent(TUTORIAL_EXIT_EVENT));
            })
          }
        />
      </>
    );
  }

  return null;
};

const mapStateToProps = (state: StoreState) => {
  return {
    ...state.tutorials,
  };
};

const connector = connect(mapStateToProps);

export const TutorialProvider = connector(TutorialProviderComponent);
