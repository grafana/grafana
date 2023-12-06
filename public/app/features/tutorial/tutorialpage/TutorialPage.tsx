import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import { addTutorials } from 'app/features/tutorial/slice';
import { TutorialPreview } from 'app/features/tutorial/tutorialpage//TutorialPreview';
import { TutorialList } from 'app/features/tutorial/tutorialpage/TutorialList';
import { tutorialPageTutorial } from 'app/features/tutorial/tutorials/tutorial-page';
import { usingPrometheusDSTutorial } from 'app/features/tutorial/tutorials/using-prometheusds';
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
    dispatch(addTutorials([usingPrometheusDSTutorial, tutorialPageTutorial]));
  };

  return (
    <Page
      navId="tutorials"
      navModel={{ node, main: node }}
      actions={
        <Button
          data-testid={`import-tutorials`}
          onClick={() => {
            console.log(`hook me up yo`);
          }}
          variant="secondary"
        >
          Import tutorials
        </Button>
      }
    >
      <Page.Contents>
        {availableTutorials.length ? (
          <TutorialPageContent availableTutorials={availableTutorials} />
        ) : (
          <EmptyListCTA
            title={`You haven't imported any tutorials yet.`}
            buttonIcon={'play'}
            buttonTitle={'Load tutorials'}
            onClick={addDSTutorial}
            proTip={'You can find tutorials in the Grafana documentation or your Grafana administrator can add them.'}
          />
        )}
      </Page.Contents>
    </Page>
  );
}

const TutorialPageContent = ({ availableTutorials }: { availableTutorials: Tutorial[] }) => {
  const styles = useStyles2(getStyles);
  const [previewTutorialId, setPreviewTutorialId] = useState<Tutorial['id'] | null>(null);

  const tutorialsByAuthor = availableTutorials.reduce<Record<string, Tutorial[]>>((acc, tutorial) => {
    if (!acc[tutorial.author]) {
      acc[tutorial.author] = [];
    }
    acc[tutorial.author].push(tutorial);
    return acc;
  }, {});

  const handlePreview = useCallback((id: Tutorial['id'] | null) => {
    setPreviewTutorialId(id);
  }, []);

  const previewTutorial = availableTutorials.find((t) => t.id === previewTutorialId) ?? null;

  return (
    <div className={styles.container}>
      <div>
        {Object.entries(tutorialsByAuthor).map(([author, tutorials]) => {
          return (
            <TutorialList
              key={author}
              author={author}
              previewTutorial={previewTutorial}
              tutorials={tutorials}
              onPreview={handlePreview}
            />
          );
        })}
      </div>
      <div>{previewTutorial && <TutorialPreview tutorial={previewTutorial} />}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: `grid`,
    gridTemplateColumns: `1fr 1fr`,
    gap: theme.spacing(4),
  }),
});

const mapStateToProps = (state: StoreState) => {
  return {
    ...state.tutorials,
  };
};

const connector = connect(mapStateToProps);

export default connector(TutorialPage);
