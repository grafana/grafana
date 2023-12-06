import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2, useTheme2 } from '@grafana/ui';
import { setCurrentTutorial, nextStep } from 'app/features/tutorial/slice';
import { Tutorial } from 'app/features/tutorial/types';
import { useDispatch } from 'app/types';

type TutorialItemProps = {
  onPreview: (tutorial: Tutorial) => void;
  tutorial: Tutorial;
};

export const TutorialItem = ({ onPreview, tutorial }: TutorialItemProps) => {
  const dispatch = useDispatch();
  const { id, name, description } = tutorial;
  const styles = useStyles2(getStyles);

  const startTutorial = useCallback(() => {
    dispatch(setCurrentTutorial(id));
    dispatch(nextStep());
  }, [dispatch, id]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className="h4">{name}</h3>
        <div className={styles.progressHeader}>
          Progress:
          <TutorialProgress tutorial={tutorial} />
        </div>
      </div>
      <p>{description}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => onPreview(tutorial)}>
          Preview tutorial
        </Button>
        <Button onClick={startTutorial}>Start tutorial</Button>
      </div>
    </div>
  );
};

const TutorialProgress = ({ tutorial }: { tutorial: Tutorial }) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const divSize = 40;
  const strokeWidth = 2;
  const circleSize = divSize + strokeWidth * 2;
  const half = circleSize / 2;
  const radius = half - strokeWidth / 2;
  const circumference = radius * 2 * Math.PI;
  const furshestStep = tutorial.furthestStepCompleted || 6;
  const percent = (furshestStep / tutorial.steps.length) * 100;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className={styles.progressCircle}>
      <svg className={styles.svgCircle} width={circleSize} height={circleSize}>
        <circle
          className="progress-ring__circle"
          stroke={theme.isDark ? `white` : `black`}
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={half}
          cy={half}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset.toFixed(2)}
        />
      </svg>
      {furshestStep} / {tutorial.steps.length}
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
  progressCircle: css({
    border: `2px solid ${theme.colors.border.weak}`,
    borderRadius: `50%`,
    display: `flex`,
    alignItems: `center`,
    justifyContent: `center`,
    width: theme.spacing(5.5),
    height: theme.spacing(5.5),
    position: `relative`,
  }),
  svgCircle: css({
    position: `absolute`,
    top: `50%`,
    left: `50%`,
    transform: `translate(-50%, -50%) rotate(-90deg)`,
  }),
  actions: css({
    display: `flex`,
    gap: theme.spacing(1),
  }),
});
