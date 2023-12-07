import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

const DIV_SIZE = 40;
const STROKE_WIDTH = 2;
const CIRCLE_SIZE = DIV_SIZE + STROKE_WIDTH * 2;

type TutorialProgressProps = {
  currentStep: number;
  totalSteps: number;
};

export const TutorialProgress = ({ currentStep, totalSteps }: TutorialProgressProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const half = CIRCLE_SIZE / 2;
  const radius = half - STROKE_WIDTH / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = (currentStep / totalSteps) * 100;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  const isComplete = percent === 100;

  return (
    <div className={styles.progressCircle} data-testid="tutorial-progress">
      <svg className={styles.svgCircle} width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
        <circle
          stroke={isComplete ? `green` : theme.colors.text.primary}
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
          r={radius}
          cx={half}
          cy={half}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset.toFixed(2)}
        />
      </svg>
      {Math.round(percent)}%
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  progressCircle: css({
    border: `${STROKE_WIDTH}px solid ${theme.colors.border.weak}`,
    borderRadius: `50%`,
    display: `flex`,
    alignItems: `center`,
    justifyContent: `center`,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    position: `relative`,
  }),
  svgCircle: css({
    position: `absolute`,
    top: `50%`,
    left: `50%`,
    transform: `translate(-50%, -50%) rotate(-90deg)`,
  }),
});
