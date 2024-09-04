import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import { useMemo } from 'react';
import { Unsubscribable } from 'rxjs';

import { config } from '@grafana/runtime';
import {
  VizPanel,
  SceneObjectBase,
  SceneGridLayout,
  SceneVariableSet,
  SceneComponentProps,
  SceneGridItemStateLike,
  SceneGridItemLike,
  sceneGraph,
  MultiValueVariable,
  LocalValueVariable,
  CustomVariable,
  VizPanelMenu,
  VizPanelState,
  VariableValueSingle,
  SceneVariable,
  SceneVariableDependencyConfigLike,
} from '@grafana/scenes';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from 'app/core/constants';

import { getMultiVariableValues, getQueryRunnerFor } from '../utils/utils';

import { AddLibraryPanelDrawer } from './AddLibraryPanelDrawer';
import { LibraryVizPanel } from './LibraryVizPanel';
import { repeatPanelMenuBehavior } from './PanelMenuBehavior';
import { DashboardRepeatsProcessedEvent } from './types';

export interface DashboardGridItemState extends SceneGridItemStateLike {
  body: VizPanel | LibraryVizPanel | AddLibraryPanelDrawer;
  repeatedPanels?: VizPanel[];
  variableName?: string;
  itemHeight?: number;
  repeatDirection?: RepeatDirection;
  maxPerRow?: number;
}

export type RepeatDirection = 'v' | 'h';

export class DashboardGridItem extends SceneObjectBase<DashboardGridItemState> implements SceneGridItemLike {
  private _libPanelSubscription: Unsubscribable | undefined;
  private _prevRepeatValues?: VariableValueSingle[];
  private _oldBody?: VizPanel | LibraryVizPanel | AddLibraryPanelDrawer;

  protected _variableDependency = new DashboardGridItemVariableDependencyHandler(this);

  public constructor(state: DashboardGridItemState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (this.state.variableName) {
      this._subs.add(this.subscribeToState((newState, prevState) => this._handleGridResize(newState, prevState)));
      if (this._oldBody !== this.state.body) {
        this._prevRepeatValues = undefined;
      }

      this._oldBody = this.state.body;
      this.performRepeat();
    }

    // Subscriptions that handles body updates, i.e. VizPanel -> LibraryVizPanel, AddLibPanelWidget -> LibraryVizPanel
    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.body !== prevState.body) {
          if (newState.body instanceof LibraryVizPanel) {
            this.setupLibraryPanelChangeSubscription(newState.body);
          }
        }
      })
    );

    // Initial setup of the lbrary panel subscription. Lib panels are lazy laded, so only then we can subscribe to the repeat config changes
    if (this.state.body instanceof LibraryVizPanel) {
      this.setupLibraryPanelChangeSubscription(this.state.body);
    }

    return () => {
      this._libPanelSubscription?.unsubscribe();
      this._libPanelSubscription = undefined;
    };
  }

  private setupLibraryPanelChangeSubscription(panel: LibraryVizPanel) {
    if (this._libPanelSubscription) {
      this._libPanelSubscription.unsubscribe();
      this._libPanelSubscription = undefined;
    }

    this._libPanelSubscription = panel.subscribeToState((newState) => {
      if (newState._loadedPanel?.model.repeat) {
        this.setState({
          variableName: newState._loadedPanel.model.repeat,
          repeatDirection: newState._loadedPanel.model.repeatDirection,
          maxPerRow: newState._loadedPanel.model.maxPerRow,
        });
        this.performRepeat();
      }
    });
  }

  /**
   * Uses the current repeat item count to calculate the user intended desired itemHeight
   */
  private _handleGridResize(newState: DashboardGridItemState, prevState: DashboardGridItemState) {
    const itemCount = this.state.repeatedPanels?.length ?? 1;
    const stateChange: Partial<DashboardGridItemState> = {};

    // Height changed
    if (newState.height === prevState.height) {
      return;
    }

    if (this.getRepeatDirection() === 'v') {
      const itemHeight = Math.ceil(newState.height! / itemCount);
      stateChange.itemHeight = itemHeight;
    } else {
      const rowCount = Math.ceil(itemCount / this.getMaxPerRow());
      stateChange.itemHeight = Math.ceil(newState.height! / rowCount);
    }

    if (stateChange.itemHeight !== this.state.itemHeight) {
      this.setState(stateChange);
    }
  }

  public performRepeat() {
    if (this.state.body instanceof AddLibraryPanelDrawer) {
      return;
    }

    if (!this.state.variableName || sceneGraph.hasVariableDependencyInLoadingState(this)) {
      return;
    }

    const variable =
      sceneGraph.lookupVariable(this.state.variableName, this) ??
      new CustomVariable({
        name: '_____default_sys_repeat_var_____',
        options: [],
        value: '',
        text: '',
        query: 'A',
      });

    if (!(variable instanceof MultiValueVariable)) {
      console.error('DashboardGridItem: Variable is not a MultiValueVariable');
      return;
    }

    const { values, texts } = getMultiVariableValues(variable);

    if (isEqual(this._prevRepeatValues, values)) {
      // In some cases, like for variables that depend on time range, the panel query runners are waiting for the top level variable to complete
      // So even when there was no change in the variable value (like in this case) we need to notify the query runners that the variable has completed it's update
      this.notifyRepeatedPanelsWaitingForVariables(variable);
      return;
    }

    this._prevRepeatValues = values;
    const panelToRepeat = this.state.body instanceof LibraryVizPanel ? this.state.body.state.panel! : this.state.body;
    const repeatedPanels: VizPanel[] = [];

    // when variable has no options (due to error or similar) it will not render any panels at all
    //  adding a placeholder in this case so that there is at least empty panel that can display error
    const emptyVariablePlaceholderOption = {
      values: [''],
      texts: variable.hasAllValue() ? ['All'] : ['None'],
    };

    const variableValues = values.length ? values : emptyVariablePlaceholderOption.values;
    const variableTexts = texts.length ? texts : emptyVariablePlaceholderOption.texts;

    // Loop through variable values and create repeats
    for (let index = 0; index < variableValues.length; index++) {
      const cloneState: Partial<VizPanelState> = {
        $variables: new SceneVariableSet({
          variables: [
            new LocalValueVariable({
              name: variable.state.name,
              value: variableValues[index],
              text: String(variableTexts[index]),
            }),
          ],
        }),
        key: `${panelToRepeat.state.key}-clone-${index}`,
      };
      if (index > 0) {
        cloneState.menu = new VizPanelMenu({
          $behaviors: [repeatPanelMenuBehavior],
        });
      }
      const clone = panelToRepeat.clone(cloneState);
      repeatedPanels.push(clone);
    }

    const direction = this.getRepeatDirection();
    const stateChange: Partial<DashboardGridItemState> = { repeatedPanels: repeatedPanels };
    const itemHeight = this.state.itemHeight ?? 10;
    const prevHeight = this.state.height;
    const maxPerRow = this.getMaxPerRow();

    if (direction === 'h') {
      const rowCount = Math.ceil(repeatedPanels.length / maxPerRow);
      stateChange.height = rowCount * itemHeight;
    } else {
      stateChange.height = repeatedPanels.length * itemHeight;
    }

    this.setState(stateChange);

    // In case we updated our height the grid layout needs to be update
    if (prevHeight !== this.state.height) {
      const layout = sceneGraph.getLayout(this);
      if (layout instanceof SceneGridLayout) {
        layout.forceRender();
      }
    }

    // Used from dashboard url sync
    this.publishEvent(new DashboardRepeatsProcessedEvent({ source: this }), true);
  }

  public notifyRepeatedPanelsWaitingForVariables(variable: SceneVariable) {
    for (const panel of this.state.repeatedPanels ?? []) {
      const queryRunner = getQueryRunnerFor(panel);
      if (queryRunner) {
        queryRunner.variableDependency?.variableUpdateCompleted(variable, false);
      }
    }
  }

  public getMaxPerRow(): number {
    return this.state.maxPerRow ?? 4;
  }

  public getRepeatDirection(): RepeatDirection {
    return this.state.repeatDirection === 'v' ? 'v' : 'h';
  }

  public getClassName() {
    return this.state.variableName ? 'panel-repeater-grid-item' : '';
  }

  public isRepeated() {
    return this.state.variableName !== undefined;
  }

  public static Component = ({ model }: SceneComponentProps<DashboardGridItem>) => {
    const { repeatedPanels, itemHeight, variableName, body } = model.useState();
    const itemCount = repeatedPanels?.length ?? 0;
    const layoutStyle = useLayoutStyle(model.getRepeatDirection(), itemCount, model.getMaxPerRow(), itemHeight ?? 10);

    if (!variableName) {
      if (body instanceof VizPanel) {
        return <body.Component model={body} key={body.state.key} />;
      }

      if (body instanceof LibraryVizPanel) {
        return <body.Component model={body} key={body.state.key} />;
      }

      if (body instanceof AddLibraryPanelDrawer) {
        return <body.Component model={body} key={body.state.key} />;
      }
    }

    if (!repeatedPanels) {
      return null;
    }

    return (
      <div className={layoutStyle}>
        {repeatedPanels.map((panel) => (
          <div className={itemStyle} key={panel.state.key}>
            <panel.Component model={panel} key={panel.state.key} />
          </div>
        ))}
      </div>
    );
  };
}

export class DashboardGridItemVariableDependencyHandler implements SceneVariableDependencyConfigLike {
  constructor(private _gridItem: DashboardGridItem) {}

  getNames(): Set<string> {
    if (this._gridItem.state.variableName) {
      return new Set([this._gridItem.state.variableName]);
    }

    return new Set();
  }

  hasDependencyOn(name: string): boolean {
    return this._gridItem.state.variableName === name;
  }

  variableUpdateCompleted(variable: SceneVariable, hasChanged: boolean): void {
    if (this._gridItem.state.variableName === variable.state.name) {
      /**
       * We do not really care if the variable has changed or not as we do an equality check in performRepeat
       * And this function needs to be called even when variable valued id not change as performRepeat calls
       * notifyRepeatedPanelsWaitingForVariables which is needed to notify panels waiting for variable to complete (even when the value did not change)
       * This is for scenarios where the variable used for repeating is depending on time range.
       */
      this._gridItem.performRepeat();
    }
  }
}

function useLayoutStyle(direction: RepeatDirection, itemCount: number, maxPerRow: number, itemHeight: number) {
  return useMemo(() => {
    const theme = config.theme2;

    // In mobile responsive layout we have to calculate the absolute height
    const mobileHeight = itemHeight * GRID_CELL_HEIGHT * itemCount + (itemCount - 1) * GRID_CELL_VMARGIN;

    if (direction === 'h') {
      const rowCount = Math.ceil(itemCount / maxPerRow);
      const columnCount = Math.min(itemCount, maxPerRow);

      return css({
        display: 'grid',
        height: '100%',
        width: '100%',
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gridTemplateRows: `repeat(${rowCount}, 1fr)`,
        gridColumnGap: theme.spacing(1),
        gridRowGap: theme.spacing(1),

        [theme.breakpoints.down('md')]: {
          display: 'flex',
          flexDirection: 'column',
          height: mobileHeight,
        },
      });
    }

    // Vertical is a bit simpler
    return css({
      display: 'flex',
      height: '100%',
      width: '100%',
      flexDirection: 'column',
      gap: theme.spacing(1),
      [theme.breakpoints.down('md')]: {
        height: mobileHeight,
      },
    });
  }, [direction, itemCount, maxPerRow, itemHeight]);
}

const itemStyle = css({
  display: 'flex',
  flexGrow: 1,
  position: 'relative',
});
