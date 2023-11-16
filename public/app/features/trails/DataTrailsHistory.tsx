import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  sceneUtils,
  SceneVariableValueChangedEvent,
  SceneObjectStateChangedEvent,
  SceneTimeRange,
} from '@grafana/scenes';
import { useStyles2, Tooltip, Stack } from '@grafana/ui';

import { DataTrail, DataTrailState } from './DataTrail';
import { VAR_FILTERS } from './shared';
import { getTrailFor } from './utils';

export interface DataTrailsHistoryState extends SceneObjectState {
  steps: DataTrailHistoryStep[];
}

export interface DataTrailHistoryStep {
  description: string;
  type: TrailStepType;
  trailState: DataTrailState;
}

export type TrailStepType = 'filters' | 'time' | 'metric' | 'start';

export class DataTrailHistory extends SceneObjectBase<DataTrailsHistoryState> {
  public constructor(state: Partial<DataTrailsHistoryState>) {
    super({ steps: state.steps ?? [] });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
    const trail = getTrailFor(this);

    if (this.state.steps.length === 0) {
      this.addTrailStep(trail, 'start');
    }

    trail.subscribeToState((newState, oldState) => {
      if (newState.metric !== oldState.metric) {
        if (this.state.steps.length === 1) {
          // For the first step we want to update the starting state so that it contains data
          this.state.steps[0].trailState = sceneUtils.cloneSceneObjectState(oldState, { history: this });
        }

        if (newState.metric) {
          this.addTrailStep(trail, 'metric');
        }
      }
    });

    trail.subscribeToEvent(SceneVariableValueChangedEvent, (evt) => {
      if (evt.payload.state.name === VAR_FILTERS) {
        this.addTrailStep(trail, 'filters');
      }
    });

    trail.subscribeToEvent(SceneObjectStateChangedEvent, (evt) => {
      if (evt.payload.changedObject instanceof SceneTimeRange) {
        this.addTrailStep(trail, 'time');
      }
    });
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
      <Stack direction="column">
        <div>{step.type}</div>
        {step.type === 'metric' && <div>{step.trailState.metric}</div>}
      </Stack>
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
      alignItems: 'center',
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
      opacity: 0.7,
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
      start: css({
        background: visTheme.getColorByName('green'),
        '&:after': {
          background: visTheme.getColorByName('green'),
        },
      }),
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
