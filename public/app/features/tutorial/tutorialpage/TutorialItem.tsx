import React, { useCallback } from 'react';

import { Button } from '@grafana/ui';
import { setCurrentTutorial, nextStep } from 'app/features/tutorial/slice';
import { Tutorial } from 'app/features/tutorial/types';
import { useDispatch } from 'app/types';

type TutorialItemProps = {
  tutorial: Tutorial;
};

export const TutorialItem = ({ tutorial }: TutorialItemProps) => {
  const dispatch = useDispatch();
  const { id, name, description } = tutorial;

  const startTutorial = useCallback(() => {
    dispatch(setCurrentTutorial(id));
    dispatch(nextStep());
  }, [dispatch, id]);

  return (
    <div>
      <h2>{name}</h2>
      <p>{description}</p>
      <Button onClick={startTutorial}>Start tutorial</Button>
    </div>
  );
};
