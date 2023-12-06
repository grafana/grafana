import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import { TutorialProgress } from 'app/features/tutorial/TutorialProgress';
import { startTutorial } from 'app/features/tutorial/slice';
import { Tutorial } from 'app/features/tutorial/types';
import { useDispatch } from 'app/types';

type TutorialItemProps = {
  arePreviewing: boolean;
  onPreview: (tutorial: Tutorial['id'] | null) => void;
  tutorial: Tutorial;
};

export const TutorialItem = ({ arePreviewing, onPreview, tutorial }: TutorialItemProps) => {
  const dispatch = useDispatch();
  const { id, name, description } = tutorial;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container} data-testid={`tutorial-item ${id}`}>
      <div className={styles.header}>
        <h3 className="h4">{name}</h3>
        <div className={styles.progressHeader}>
          Progress:
          <TutorialProgress tutorial={tutorial} />
        </div>
      </div>
      <p>{description}</p>
      <div className={styles.actions}>
        <Button
          data-testid="tutorial-item preview"
          icon={arePreviewing ? `eye-slash` : `eye`}
          variant="secondary"
          onClick={() => onPreview(arePreviewing ? null : tutorial.id)}
        >
          Preview tutorial
        </Button>
        <Button
          data-testid="tutorial-item start"
          onClick={() => {
            dispatch(startTutorial(id));
          }}
        >
          Start tutorial
        </Button>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(2),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
  }),
  header: css({
    display: `flex`,
    alignItems: `center`,
    justifyContent: `space-between`,
  }),
  progressHeader: css({
    display: `flex`,
    alignItems: `center`,
    gap: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  actions: css({
    display: `flex`,
    gap: theme.spacing(1),
  }),
});
