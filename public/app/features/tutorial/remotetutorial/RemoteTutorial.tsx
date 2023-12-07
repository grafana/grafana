import React from 'react';

import { Button } from '@grafana/ui';
import { addTutorials, resetTutorials, startTutorial } from 'app/features/tutorial/slice';
import { Tutorial } from 'app/features/tutorial/types';
import { useDispatch } from 'app/types';

type TutorialItemProps = {
  tutorial: Tutorial;
};

export const RemoteTutorial = ({ tutorial }: TutorialItemProps) => {
  const dispatch = useDispatch();
  const { id } = tutorial;
  dispatch(resetTutorials());
  dispatch(addTutorials([tutorial]));

  return (
    <Button
      data-testid="tutorial-item start"
      onClick={() => {
        dispatch(startTutorial(id));
      }}
    >
      Start tutorial
    </Button>
  );
};
