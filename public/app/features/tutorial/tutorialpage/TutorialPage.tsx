import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { NavModelItem } from '@grafana/data';
import { Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { addTutorial } from 'app/features/tutorial/slice';
import { TutorialItem } from 'app/features/tutorial/tutorialpage/TutorialItem';
import { tutorial } from 'app/features/tutorial/tutorials/using-prometheusds';
import type { Tutorial } from 'app/features/tutorial/types';
import { StoreState, useDispatch } from 'app/types';

const node: NavModelItem = {
  id: 'tutorials',
  text: 'Tutorials',
  subTitle: 'Your tutorials',
  url: '/tutorials',
};

export function TutorialPage({ availableTutorials }: ConnectedProps<typeof connector>) {
  const dispatch = useDispatch();
  const addDSTutorial = () => {
    dispatch(addTutorial(tutorial));
  };

  return (
    <Page navId="tutorials" navModel={{ node, main: node }}>
      <Page.Contents>
        <Button onClick={addDSTutorial}>Load tutorials</Button>
        {availableTutorials.map((tutorial: Tutorial) => {
          return <TutorialItem key={tutorial.id} tutorial={tutorial} />;
        })}
      </Page.Contents>
    </Page>
  );
}
const mapStateToProps = (state: StoreState) => {
  return {
    ...state.tutorials,
  };
};

const connector = connect(mapStateToProps);

export default connector(TutorialPage);
