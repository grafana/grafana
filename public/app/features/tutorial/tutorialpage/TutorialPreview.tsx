import { css, cx } from '@emotion/css';
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
              <div
                className={cx(styles.step, {
                  [styles.completed]: isCompleted,
                })}
              >
                {index + 1}
                {isCompleted && <Icon name={'check'} color={`green`} />}
              </div>
              <div className={styles.info}>
                {step.title && (
                  <Text element="h3" variant="h5">
                    {step.title}
                  </Text>
                )}
                <div>{step.content}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ICON_SIZE = `32px`;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: `grid`,
    gap: theme.spacing(1),
  }),
  card: css({
    display: `grid`,
    gridTemplateColumns: `${ICON_SIZE} 1fr`,
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
  }),
  info: css({
    display: `grid`,
    gap: theme.spacing(1),
  }),
  step: css({
    display: `flex`,
    alignItems: `center`,
    justifyContent: `center`,
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: `50%`,
    backgroundColor: theme.colors.background.primary,
    border: `2px solid ${theme.colors.border.weak}`,
    position: `relative`,

    [`& > svg`]: {
      position: `absolute`,
      top: `-8px`,
      right: `-8px`,
      background: theme.colors.background.primary,
      borderRadius: `50%`,
      color: theme.colors.text.primary,
    },
  }),
  completed: css({
    border: `2px solid green`,
  }),
});
