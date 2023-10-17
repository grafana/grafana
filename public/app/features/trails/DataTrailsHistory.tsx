import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState, SceneObjectBase, SceneComponentProps, sceneUtils } from '@grafana/scenes';
import { useStyles2, Tooltip } from '@grafana/ui';
import { Flex } from '@grafana/ui/src/unstable';

import { DataTrail, DataTrailState } from './DataTrail';
import { getTrailFor } from './getUtils';

export interface DataTrailsHistoryState extends SceneObjectState {
  steps: DataTrailHistoryStep[];
}

export interface DataTrailHistoryStep {
  description: string;
  type: TrailStepType;
  trailState: DataTrailState;
}

export type TrailStepType = 'filters' | 'time' | 'metric';

export class DataTrailHistory extends SceneObjectBase<DataTrailsHistoryState> {
  public constructor(state: Partial<DataTrailsHistoryState>) {
    super({ steps: state.steps ?? [] });
  }

  public addTrailStep(trail: DataTrail, type: TrailStepType) {
    this.setState({
      steps: [
        ...this.state.steps,
        {
          description: 'Test',
          type,
          trailState: sceneUtils.cloneSceneObjectState(trail.state, { history: this }),
        },
      ],
    });
  }

  renderStepTooltip(step: DataTrailHistoryStep) {
    return (
      <Flex direction="column">
        <div>{step.type}</div>
        {step.type === 'metric' && <div>{step.trailState.metric}</div>}
      </Flex>
    );
  }

  public static Component = ({ model }: SceneComponentProps<DataTrailHistory>) => {
    const { steps } = model.useState();
    const styles = useStyles2(getStyles);
    const trail = getTrailFor(model);

    return (
      <div className={styles.container}>
        <div className={styles.heading}>Trail</div>
        {steps.map((step, index) => (
          <Tooltip content={() => model.renderStepTooltip(step)} key={index}>
            <button
              className={cx(styles.step, styles.stepTypes[step.type])}
              onClick={() => trail.goBackToStep(step)}
            ></button>
          </Tooltip>
        ))}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  const visTheme = theme.visualization;

  return {
    container: css({
      display: 'flex',
      gap: 10,
      marginTop: theme.spacing(1),
      alignItems: 'center',
      opacity: 0.7,
    }),
    heading: css({}),
    step: css({
      flexGrow: 0,
      cursor: 'pointer',
      border: 'none',
      boxShadow: 'none',
      padding: 0,
      margin: 0,
      width: 8,
      height: 8,
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.primary.main,
      position: 'relative',
      '&:hover': {
        transform: 'scale(1.1)',
      },
      '&:after': {
        content: '""',
        position: 'absolute',
        width: 10,
        height: 2,
        left: 8,
        top: 3,
        background: theme.colors.primary.border,
      },
      '&:last-child': {
        '&:after': {
          display: 'none',
        },
      },
    }),
    stepTypes: {
      filters: css({
        background: visTheme.getColorByName('purple'),
        '&:after': {
          background: visTheme.getColorByName('purple'),
        },
      }),
      metric: css({
        background: visTheme.getColorByName('orange'),
        '&:after': {
          background: visTheme.getColorByName('orange'),
        },
      }),
      time: css({
        background: theme.colors.primary.main,
        '&:after': {
          background: theme.colors.primary.main,
        },
      }),
    },
  };
}
