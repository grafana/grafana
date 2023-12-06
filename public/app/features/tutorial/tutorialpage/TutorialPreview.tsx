import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Text, useStyles2 } from '@grafana/ui';
import type { Tutorial } from 'app/features/tutorial/types';

type TutorialPreviewProps = {
  tutorial: Tutorial;
};

export const TutorialPreview = ({ tutorial }: TutorialPreviewProps) => {
  const styles = useStyles2(getStyles);
  const furthestStep = tutorial.furthestStepCompleted ?? -1;

  return (
    <div data-testid="tutorial-preview">
      <h2 className="h5">{tutorial.name} preview</h2>
      <div className={styles.container}>
        {tutorial.steps.map((step, index) => {
          const isCompleted = index <= furthestStep;

          return (
            <div className={styles.card} key={index}>
              <div className={styles.header}>
                {step.title && (
                  <Text element="h3" variant="h5">
                    {step.title}
                  </Text>
                )}
                {isCompleted && <Icon name={`check-circle`} color={`green`} size="xl" />}
              </div>
              <p>{step.content}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: `grid`,
    gap: theme.spacing(1),
  }),
  card: css({
    padding: theme.spacing(2),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
  }),
  header: css({
    display: `flex`,
    gap: theme.spacing(1),
    alignItems: `center`,
  }),
});
