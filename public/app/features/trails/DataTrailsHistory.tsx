import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';

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
  currentStep: number;
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
    super({ steps: state.steps ?? [], currentStep: state.currentStep ?? 0 });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
    const trail = getTrailFor(this);

    if (this.state.steps.length === 0) {
      this.addTrailStep(trail, 'start');
    }

    trail.subscribeToState((newState, oldState) => {
      // Check if new and old state are at the same step index
      // Then we know this is a history transition
      const isMovingThroughHistory = newState.stepIndex !== oldState.stepIndex;

      if (isMovingThroughHistory) {
        this.setState({
          ...this.state,
          currentStep: newState.stepIndex,
        });

        return;
      }

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
    // Update the trail's new current step state, and note its parent step.
    const stepIndex = this.state.steps.length;
    const parentIndex = type === 'start' ? -1 : trail.state.stepIndex;
    trail.setState({ ...trail.state, stepIndex, parentIndex });

    this.setState({
      currentStep: stepIndex,
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
    const { steps, currentStep } = model.useState();
    const styles = useStyles2(getStyles);
    const trail = getTrailFor(model);

    const { ancestry, alternatePredecessorStyle } = useMemo(() => {
      const ancestry = new Set<number>();
      let cursor = currentStep;
      while (cursor >= 0) {
        ancestry.add(cursor);
        cursor = steps[cursor].trailState.parentIndex;
      }

      const alternatePredecessorStyle = new Map<number, string>();

      ancestry.forEach((index) => {
        const parent = steps[index].trailState.parentIndex;
        if (parent + 1 !== index) {
          alternatePredecessorStyle.set(index, createAlternatePredecessorStyle(index, parent));
        }
      });

      return { ancestry, alternatePredecessorStyle };
    }, [currentStep, steps]);

    return (
      <div className={styles.container}>
        <div className={styles.heading}>Trail</div>
        {steps.map((step, index) => (
          <Tooltip content={() => model.renderStepTooltip(step)} key={index}>
            <button
              className={cx(
                // Base for all steps
                styles.step,
                // Specifics per step type
                styles.stepTypes[step.type],
                // To highlight selected step
                model.state.currentStep === index ? styles.stepSelected : '',
                // To alter the look of steps with distant non-directly preceding parent
                alternatePredecessorStyle.get(index) ?? '',
                // To remove direct link for steps that don't have a direct parent
                index !== step.trailState.parentIndex + 1 ? styles.stepOmitsDirectLeftLink : '',
                // To remove the direct parent link on the start node as well
                index === 0 ? styles.stepOmitsDirectLeftLink : '',
                // To darken steps that aren't the current step's ancesters
                !ancestry.has(index) ? styles.stepIsNotAncestorOfCurrent : ''
              )}
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
        opacity: 1,
      },
      '&:hover:before': {
        // We only want the node to hover, not its connection to its parent
        opacity: 0.7,
      },
      '&:before': {
        content: '""',
        position: 'absolute',
        width: 10,
        height: 2,
        left: -10,
        top: 3,
        background: theme.colors.primary.border,
        pointerEvents: 'none',
      },
    }),
    stepSelected: css({
      '&:after': {
        content: '""',
        borderStyle: `solid`,
        borderWidth: 2,
        borderRadius: '50%',
        position: 'absolute',
        width: 16,
        height: 16,
        left: -4,
        top: -4,
        boxShadow: `0px 0px 0px 2px inset ${theme.colors.background.canvas}`,
      },
    }),
    stepOmitsDirectLeftLink: css({
      '&:before': {
        background: 'none',
      },
    }),
    stepIsNotAncestorOfCurrent: css({
      opacity: 0.2,
      '&:hover:before': {
        opacity: 0.2,
      },
    }),
    stepTypes: {
      start: generateStepTypeStyle(visTheme.getColorByName('green')),
      filters: generateStepTypeStyle(visTheme.getColorByName('purple')),
      metric: generateStepTypeStyle(visTheme.getColorByName('orange')),
      time: generateStepTypeStyle(theme.colors.primary.main),
    },
  };
}

function generateStepTypeStyle(color: string) {
  return css({
    background: color,
    '&:before': {
      background: color,
      borderColor: color,
    },
    '&:after': {
      borderColor: color,
    },
  });
}

function createAlternatePredecessorStyle(index: number, parent: number) {
  const difference = index - parent;

  const NODE_DISTANCE = 18;
  const distanceToParent = difference * NODE_DISTANCE;

  return css({
    '&:before': {
      content: '""',
      width: distanceToParent + 2,
      height: 10,
      borderStyle: 'solid',
      borderWidth: 2,
      borderBottom: 'none',
      top: -10,
      left: 3 - distanceToParent,
      background: 'none',
    },
  });
}
