import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { TutorialItem } from 'app/features/tutorial/tutorialpage/TutorialItem';
import type { Tutorial } from 'app/features/tutorial/types';

type TutorialListProps = {
  author: Tutorial['author'];
  onPreview: (tutorial: Tutorial['id'] | null) => void;
  previewTutorial: Tutorial | null;
  tutorials: Tutorial[];
};

export const TutorialList = ({ author, onPreview, previewTutorial, tutorials }: TutorialListProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div data-testid={`tutorial-list ${author}`}>
      <h2>{author} tutorials</h2>
      <div className={styles.list}>
        {tutorials.map((tutorial) => {
          return (
            <TutorialItem
              arePreviewing={previewTutorial?.id === tutorial.id}
              key={tutorial.id}
              onPreview={onPreview}
              tutorial={tutorial}
            />
          );
        })}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    display: `grid`,
    gap: theme.spacing(2),
  }),
});
