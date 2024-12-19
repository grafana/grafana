import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { getTimeZoneInfo, GrafanaTheme2, InternalTimeZones, TIME_FORMAT } from '@grafana/data';
import { convertRawToRange } from '@grafana/data/src/datetime/rangeutil';
import { config } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneObjectUrlValue,
  SceneObjectUrlValues,
  SceneTimeRange,
  sceneUtils,
  SceneVariableValueChangedEvent,
} from '@grafana/scenes';
import { Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { RecordHistoryEntryEvent } from 'app/types/events';

import { DataTrail, DataTrailState, getTopSceneFor } from './DataTrail';
import { SerializedTrailHistory } from './TrailStore/TrailStore';
import { reportExploreMetrics } from './interactions';
import { VAR_FILTERS, VAR_OTEL_DEPLOYMENT_ENV, VAR_OTEL_RESOURCES } from './shared';
import { getTrailFor, isSceneTimeRangeState } from './utils';

export interface DataTrailsHistoryState extends SceneObjectState {
  currentStep: number;
  steps: DataTrailHistoryStep[];
  filtersApplied: string[];
  otelResources: string[];
  otelDepEnvs: string[];
}

export function isDataTrailsHistoryState(state: SceneObjectState): state is DataTrailsHistoryState {
  return 'currentStep' in state && 'steps' in state;
}

export function isDataTrailHistoryFilter(filter?: SceneObjectUrlValue): filter is string[] {
  return !!filter;
}

const isString = (value: unknown): value is string => typeof value === 'string';

export interface DataTrailHistoryStep {
  description: string;
  detail: string;
  type: TrailStepType;
  trailState: DataTrailState;
  parentIndex: number;
}

export type TrailStepType = 'filters' | 'time' | 'metric' | 'start' | 'metric_page' | 'dep_env' | 'resource';

const filterSubst = ` $2 `;
const filterPipeRegex = /(\|)(=|=~|!=|>|<|!~)(\|)/g;
const stepDescriptionMap: Record<TrailStepType, string> = {
  start: 'Start of history',
  metric: 'Metric selected:',
  metric_page: 'Metric select page',
  filters: 'Filter applied:',
  time: 'Time range changed:',
  dep_env: 'Deployment environment selected:',
  resource: 'Resource attribute selected:',
};

export class DataTrailHistory extends SceneObjectBase<DataTrailsHistoryState> {
  public constructor(state: Partial<DataTrailsHistoryState>) {
    super({
      steps: state.steps ?? [],
      currentStep: state.currentStep ?? 0,
      filtersApplied: [],
      otelResources: [],
      otelDepEnvs: [],
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private stepTransitionInProgress = false;

  public _onActivate() {
    const trail = getTrailFor(this);

    if (this.state.steps.length === 0) {
      // We always want to ensure in initial 'start' step
      this.addTrailStep(trail, 'start');

      if (trail.state.metric) {
        // But if our current trail has a metric, we want to remove it and the topScene,
        // so that the "start" step always displays a metric select screen.

        // So we remove the metric and update the topscene for the "start" step
        const { metric, ...startState } = trail.state;
        startState.topScene = getTopSceneFor(undefined);
        this.state.steps[0].trailState = startState;

        // But must add a secondary step to represent the selection of the metric
        // for this restored trail state
        this.addTrailStep(trail, 'metric', trail.state.metric);
      } else {
        this.addTrailStep(trail, 'metric_page');
      }
    }

    trail.subscribeToState((newState, oldState) => {
      if (newState.metric !== oldState.metric) {
        if (this.state.steps.length === 1) {
          // For the first step we want to update the starting state so that it contains data
          this.state.steps[0].trailState = sceneUtils.cloneSceneObjectState(oldState, { history: this });
        }

        if (!newState.metric) {
          this.addTrailStep(trail, 'metric_page');
        } else {
          this.addTrailStep(trail, 'metric', newState.metric);
        }
      }
    });

    trail.subscribeToEvent(SceneVariableValueChangedEvent, (evt) => {
      if (evt.payload.state.name === VAR_FILTERS) {
        const filtersApplied = this.state.filtersApplied;
        const urlState = sceneUtils.getUrlState(trail);
        this.addTrailStep(trail, 'filters', parseFilterTooltip(urlState, filtersApplied));
        this.setState({ filtersApplied });
      }

      if (evt.payload.state.name === VAR_OTEL_DEPLOYMENT_ENV) {
        const otelDepEnvs = this.state.otelDepEnvs;
        const urlState = sceneUtils.getUrlState(trail);
        this.addTrailStep(trail, 'dep_env', parseDepEnvTooltip(urlState, otelDepEnvs));
        this.setState({ otelDepEnvs });
      }

      if (evt.payload.state.name === VAR_OTEL_RESOURCES) {
        const otelResources = this.state.otelResources;
        const urlState = sceneUtils.getUrlState(trail);
        this.addTrailStep(trail, 'resource', parseOtelResourcesTooltip(urlState, otelResources));
        this.setState({ otelResources });
      }
    });

    trail.subscribeToEvent(SceneObjectStateChangedEvent, (evt) => {
      if (evt.payload.changedObject instanceof SceneTimeRange) {
        const { prevState, newState } = evt.payload;

        if (isSceneTimeRangeState(prevState) && isSceneTimeRangeState(newState)) {
          if (prevState.from === newState.from && prevState.to === newState.to) {
            return;
          }

          const tooltip = parseTimeTooltip({
            from: newState.from,
            to: newState.to,
            timeZone: newState.timeZone,
          });

          this.addTrailStep(trail, 'time', tooltip);

          if (config.featureToggles.unifiedHistory) {
            appEvents.publish(
              new RecordHistoryEntryEvent({
                name: 'Time range changed',
                description: tooltip,
                url: window.location.href,
                time: Date.now(),
              })
            );
          }
        }
      }
    });
  }

  public addTrailStep(trail: DataTrail, type: TrailStepType, detail = '') {
    if (this.stepTransitionInProgress) {
      // Do not add trail steps when step transition is in progress
      return;
    }

    const stepIndex = this.state.steps.length;
    const parentIndex = type === 'start' ? -1 : this.state.currentStep;

    this.setState({
      currentStep: stepIndex,
      steps: [
        ...this.state.steps,
        {
          type,
          detail,
          description: stepDescriptionMap[type],
          trailState: sceneUtils.cloneSceneObjectState(trail.state, { history: this }),
          parentIndex,
        },
      ],
    });
  }

  public addTrailStepFromStorage(trail: DataTrail, step: SerializedTrailHistory) {
    if (this.stepTransitionInProgress) {
      // Do not add trail steps when step transition is in progress
      return;
    }

    const type = step.type;
    const stepIndex = this.state.steps.length;
    const parentIndex = type === 'start' ? -1 : this.state.currentStep;
    const filtersApplied = this.state.filtersApplied;
    const otelResources = this.state.otelResources;
    const otelDepEnvs = this.state.otelDepEnvs;
    let detail = '';

    switch (step.type) {
      case 'metric':
        detail = step.urlValues.metric?.toString() ?? '';
        break;
      case 'filters':
        detail = parseFilterTooltip(step.urlValues, filtersApplied);
        break;
      case 'time':
        detail = parseTimeTooltip(step.urlValues);
        break;
      case 'dep_env':
        detail = parseDepEnvTooltip(step.urlValues, otelDepEnvs);
      case 'resource':
        detail = parseOtelResourcesTooltip(step.urlValues, otelResources);
    }

    this.setState({
      filtersApplied,
      otelDepEnvs,
      otelResources,
      currentStep: stepIndex,
      steps: [
        ...this.state.steps,
        {
          type,
          detail,
          description: stepDescriptionMap[type],
          trailState: sceneUtils.cloneSceneObjectState(trail.state, { history: this }),
          parentIndex,
        },
      ],
    });
  }

  public goBackToStep(stepIndex: number) {
    if (stepIndex === this.state.currentStep) {
      return;
    }

    const step = this.state.steps[stepIndex];
    const type = step.type === 'metric' && step.trailState.metric === undefined ? 'metric-clear' : step.type;

    reportExploreMetrics('history_step_clicked', { type, step: stepIndex, numberOfSteps: this.state.steps.length });

    this.stepTransitionInProgress = true;
    this.setState({ currentStep: stepIndex });

    getTrailFor(this).restoreFromHistoryStep(step.trailState);

    // The URL will update
    this.stepTransitionInProgress = false;
  }

  renderStepTooltip(step: DataTrailHistoryStep) {
    return (
      <Stack direction="column">
        <div>{step.description}</div>
        {step.detail !== '' && <div>{step.detail}</div>}
      </Stack>
    );
  }

  public static Component = ({ model }: SceneComponentProps<DataTrailHistory>) => {
    const { steps, currentStep } = model.useState();
    const styles = useStyles2(getStyles);

    const { ancestry, alternatePredecessorStyle } = useMemo(() => {
      const ancestry = new Set<number>();

      let cursor = currentStep;
      while (cursor >= 0) {
        const step = steps[cursor];
        if (!step) {
          break;
        }
        ancestry.add(cursor);
        cursor = step.parentIndex;
      }

      const alternatePredecessorStyle = new Map<number, string>();

      ancestry.forEach((index) => {
        const parent = steps[index].parentIndex;
        if (parent + 1 !== index) {
          alternatePredecessorStyle.set(index, createAlternatePredecessorStyle(index, parent));
        }
      });

      return { ancestry, alternatePredecessorStyle };
    }, [currentStep, steps]);

    return (
      <div className={styles.container}>
        <div className={styles.heading}>History</div>
        {steps.map((step, index) => {
          let stepType = step.type;

          if (stepType === 'metric' && step.trailState.metric === undefined) {
            // If we're resetting the metric, we want it to look like a start node
            stepType = 'start';
          }

          return (
            <Tooltip content={() => model.renderStepTooltip(step)} key={index}>
              <button
                className={cx(
                  // Base for all steps
                  styles.step,
                  // Specifics per step type
                  styles.stepTypes[stepType],
                  // To highlight selected step
                  currentStep === index ? styles.stepSelected : '',
                  // To alter the look of steps with distant non-directly preceding parent
                  alternatePredecessorStyle.get(index) ?? '',
                  // To remove direct link for steps that don't have a direct parent
                  index !== step.parentIndex + 1 ? styles.stepOmitsDirectLeftLink : '',
                  // To remove the direct parent link on the start node as well
                  index === 0 ? styles.stepOmitsDirectLeftLink : '',
                  // To darken steps that aren't the current step's ancesters
                  !ancestry.has(index) ? styles.stepIsNotAncestorOfCurrent : ''
                )}
                onClick={() => model.goBackToStep(index)}
              ></button>
            </Tooltip>
          );
        })}
      </div>
    );
  };
}

export function parseTimeTooltip(urlValues: SceneObjectUrlValues): string {
  if (!isSceneTimeRangeState(urlValues)) {
    return '';
  }

  const range = convertRawToRange({
    from: urlValues.from,
    to: urlValues.to,
  });

  const zone = isString(urlValues.timeZone) ? urlValues.timeZone : InternalTimeZones.localBrowserTime;
  const tzInfo = getTimeZoneInfo(zone, Date.now());

  const from = range.from.subtract(tzInfo?.offsetInMins ?? 0, 'minute').format(TIME_FORMAT);
  const to = range.to.subtract(tzInfo?.offsetInMins ?? 0, 'minute').format(TIME_FORMAT);

  return `${from} - ${to}`;
}

export function parseFilterTooltip(urlValues: SceneObjectUrlValues, filtersApplied: string[]): string {
  let detail = '';
  const varFilters = urlValues['var-filters'];
  if (isDataTrailHistoryFilter(varFilters)) {
    detail =
      varFilters.filter((f) => {
        if (f !== '' && !filtersApplied.includes(f)) {
          filtersApplied.push(f);
          return true;
        }
        return false;
      })[0] ?? '';
  }
  // filters saved as key|operator|value
  // we need to remove pipes (|)
  return detail.replace(filterPipeRegex, filterSubst);
}

export function parseOtelResourcesTooltip(urlValues: SceneObjectUrlValues, otelResources: string[]): string {
  let detail = '';
  const varOtelResources = urlValues['var-otel_resources'];
  if (isDataTrailHistoryFilter(varOtelResources)) {
    detail =
      varOtelResources.filter((f) => {
        if (f !== '' && !otelResources.includes(f)) {
          otelResources.push(f);
          return true;
        }
        return false;
      })[0] ?? '';
  }
  // filters saved as key|operator|value
  // we need to remove pipes (|)
  return detail.replace(filterPipeRegex, filterSubst);
}

export function parseDepEnvTooltip(urlValues: SceneObjectUrlValues, otelDepEnvs: string[]): string {
  let detail = '';
  const varDepEnv = urlValues['var-deployment_environment'];

  if (typeof varDepEnv === 'string') {
    return varDepEnv;
  }

  if (isDataTrailHistoryFilter(varDepEnv)) {
    detail =
      varDepEnv?.filter((f) => {
        if (f !== '' && !otelDepEnvs.includes(f)) {
          otelDepEnvs.push(f);
          return true;
        }
        return false;
      })[0] ?? '';
  }

  return detail;
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
      metric_page: generateStepTypeStyle(visTheme.getColorByName('orange')),
      time: generateStepTypeStyle(theme.colors.primary.main),
      resource: generateStepTypeStyle(visTheme.getColorByName('purple')),
      dep_env: generateStepTypeStyle(visTheme.getColorByName('purple')),
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
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      top: -10,
      left: 3 - distanceToParent,
      background: 'none',
    },
  });
}
