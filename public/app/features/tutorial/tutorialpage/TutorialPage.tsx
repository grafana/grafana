import { css } from '@emotion/css';
import React, { type ChangeEvent, useCallback, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { Button, Stack, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import { addingAProbe } from 'app/features/tutorial//tutorials/adding-a-probe';
import { addTutorials } from 'app/features/tutorial/slice';
import { TutorialPreview } from 'app/features/tutorial/tutorialpage//TutorialPreview';
import { TutorialList } from 'app/features/tutorial/tutorialpage/TutorialList';
// import { changingPasswordTutorial } from 'app/features/tutorial/tutorials/changing-password';
import { creatingAk6Project } from 'app/features/tutorial/tutorials/creating-a-k6-project';
// import { tutorialPageTutorial } from 'app/features/tutorial/tutorials/tutorial-page';
// import { usingPrometheusDSTutorial } from 'app/features/tutorial/tutorials/using-prometheusds';
import type { Tutorial } from 'app/features/tutorial/types';
import { StoreState, useDispatch } from 'app/types';

const node: NavModelItem = {
  id: 'tutorials',
  text: 'Tutorials',
  subTitle: 'Learn everything about Grafana',
  url: '/tutorials',
};

export function TutorialPage({ availableTutorials }: ConnectedProps<typeof connector>) {
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const addDSTutorial = () => {
    setLoading(true);

    setTimeout(() => {
      dispatch(
        addTutorials([
          // usingPrometheusDSTutorial,
          // tutorialPageTutorial,
          creatingAk6Project,
          addingAProbe,
          // changingPasswordTutorial,
        ])
      );
    }, 500);
  };

  return (
    <Page navId="tutorials" navModel={{ node, main: node }} actions={<Actions />}>
      <Page.Contents>
        {availableTutorials.length ? (
          <TutorialPageContent availableTutorials={availableTutorials} />
        ) : (
          <EmptyListCTA
            title={`You haven't imported any tutorials yet.`}
            buttonIcon={loading ? 'fa fa-spinner' : 'play'}
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
      <Stack gap={4} direction={`column`}>
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
      </Stack>
      <div>{previewTutorial && <TutorialPreview tutorial={previewTutorial} />}</div>
    </div>
  );
};

const Actions = () => {
  const uploadRef = useRef<HTMLInputElement>(null);
  const dispatch = useDispatch();

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target?.result;

        if (content) {
          const tutorial: Tutorial = typeof content === 'string' && JSON.parse(content);

          if (tutorial) {
            dispatch(addTutorials([tutorial]));
          }
        }
      };

      file && reader.readAsText(file);
    },
    [dispatch]
  );

  return (
    <>
      <input onChange={handleFileChange} type="file" name="tutorialupload" hidden ref={uploadRef} />
      <Button
        data-testid={`import-tutorial`}
        onClick={() => {
          uploadRef.current?.click();
        }}
        icon="upload"
        variant="secondary"
      >
        Import tutorial
      </Button>
    </>
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
