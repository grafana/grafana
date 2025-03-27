import { isEqual } from 'lodash';
import { createRef } from 'react';

import {
  CustomVariable,
  LocalValueVariable,
  MultiValueVariable,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSingle,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { getCloneKey } from '../../utils/clone';
import { getMultiVariableValues } from '../../utils/utils';
import { Point, Rect } from '../layout-manager/utils';
import { DashboardLayoutItem, IntermediateLayoutItem } from '../types/DashboardLayoutItem';
import { DashboardRepeatsProcessedEvent } from '../types/DashboardRepeatsProcessedEvent';

import { getOptions } from './ResponsiveGridItemEditor';
import { AutoGridItemRenderer } from './ResponsiveGridItemRenderer';

export interface AutoGridItemState extends SceneObjectState {
  body: VizPanel;
  hideWhenNoData?: boolean;
  repeatedPanels?: VizPanel[];
  variableName?: string;
  isHidden?: boolean;
  conditionalRendering?: ConditionalRendering;
}

export class AutoGridItem extends SceneObjectBase<AutoGridItemState> implements DashboardLayoutItem {
  public static Component = AutoGridItemRenderer;
  private _prevRepeatValues?: VariableValueSingle[];
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: this.state.variableName ? [this.state.variableName] : [],
    onVariableUpdateCompleted: () => this.performRepeat(),
  });
  public readonly isDashboardLayoutItem = true;
  public containerRef = createRef<HTMLDivElement>();
  public cachedBoundingBox: Rect | undefined;

  public constructor(state: AutoGridItemState) {
    super({ ...state, conditionalRendering: state?.conditionalRendering ?? ConditionalRendering.createEmpty() });
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (this.state.variableName) {
      this.performRepeat();
    }

    const deactivate = this.state.conditionalRendering?.activate();

    return () => {
      if (deactivate) {
        deactivate();
      }
    };
  }

  public getOptions(): OptionsPaneCategoryDescriptor[] {
    return getOptions(this);
  }

  public performRepeat() {
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
      return;
    }

    const panelToRepeat = this.state.body;
    const repeatedPanels: VizPanel[] = [];

    // when variable has no options (due to error or similar) it will not render any panels at all
    // adding a placeholder in this case so that there is at least empty panel that can display error
    const emptyVariablePlaceholderOption = {
      values: [''],
      texts: variable.hasAllValue() ? ['All'] : ['None'],
    };

    const variableValues = values.length ? values : emptyVariablePlaceholderOption.values;
    const variableTexts = texts.length ? texts : emptyVariablePlaceholderOption.texts;
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
        key: getCloneKey(panelToRepeat.state.key!, index),
      };
      const clone = panelToRepeat.clone(cloneState);
      repeatedPanels.push(clone);
    }

    this.setState({ repeatedPanels });
    this._prevRepeatValues = values;

    this.publishEvent(new DashboardRepeatsProcessedEvent({ source: this }), true);
  }

  public setRepeatByVariable(variableName: string | undefined) {
    const stateUpdate: Partial<AutoGridItemState> = { variableName };

    if (this.state.body.state.$variables) {
      this.state.body.setState({ $variables: undefined });
    }

    this._variableDependency.setVariableNames(variableName ? [variableName] : []);

    this.setState(stateUpdate);
    this.performRepeat();
  }

  public computeBoundingBox() {
    const itemContainer = this.containerRef.current;
    if (!itemContainer || this.state.isHidden) {
      // We can't actually calculate the dimensions of the rendered grid item :(
      throw new Error('Unable to compute bounding box.');
    }

    this.cachedBoundingBox = itemContainer.getBoundingClientRect();
    return this.cachedBoundingBox;
  }

  public distanceToPoint(point: Point): number {
    if (!this.cachedBoundingBox) {
      try {
        this.cachedBoundingBox = this.computeBoundingBox();
      } catch (err) {
        // If we can't actually calculate the dimensions and position of the
        // rendered grid item, it might as well be infinitely far away.
        return Number.POSITIVE_INFINITY;
      }
    }

    const { top, left, bottom, right } = this.cachedBoundingBox;
    const corners: Point[] = [
      { x: left, y: top },
      { x: left, y: bottom },
      { x: right, y: top },
      { x: right, y: bottom },
    ];

    const { distance } = closestPoint(point, ...corners);
    return distance;
  }

  toIntermediate(): IntermediateLayoutItem {
    const gridItem = this.containerRef.current;

    if (!gridItem) {
      throw new Error('Grid item not found. Unable to convert to intermediate representation');
    }

    // calculate origin and bounding box of layout item
    const rect = gridItem.getBoundingClientRect();

    return {
      body: this.state.body,
      origin: {
        x: rect.left,
        y: rect.top,
      },
      width: rect.width,
      height: rect.height,
    };
  }
}

// todo@kay: tests
function closestPoint(referencePoint: Point, ...points: Point[]): { point: Point; distance: number } {
  let minDistance = Number.POSITIVE_INFINITY;
  let closestPoint = points[0];
  for (const currentPoint of points) {
    const distance = euclideanDistance(referencePoint, currentPoint);
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = currentPoint;
    }
  }

  return { point: closestPoint, distance: minDistance };
}

function euclideanDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
