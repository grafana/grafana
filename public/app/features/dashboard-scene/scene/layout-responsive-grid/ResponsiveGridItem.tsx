import { isEqual } from 'lodash';
import React, { CSSProperties } from 'react';

import {
  SceneObject,
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

import { getCloneKey } from '../../utils/clone';
import { getMultiVariableValues } from '../../utils/utils';
import { closestOfType, Point, Rect } from '../layout-manager/utils';
import { DashboardLayoutItem, IntermediateLayoutItem } from '../types/DashboardLayoutItem';
import { DashboardRepeatsProcessedEvent } from '../types/DashboardRepeatsProcessedEvent';

import { getOptions } from './ResponsiveGridItemEditor';
import { ResponsiveGridItemRenderer } from './ResponsiveGridItemRenderer';
import { ResponsiveGridLayout } from './ResponsiveGridLayout';

export interface ResponsiveGridItemStatePlacement {
  /**
   * Useful for making content span across multiple rows or columns
   */
  gridColumn?: CSSProperties['gridColumn'];
  gridRow?: CSSProperties['gridRow'];
}

export interface ResponsiveGridItemState extends SceneObjectState {
  body: VizPanel;
  hideWhenNoData?: boolean;
  repeatedPanels?: VizPanel[];
  variableName?: string;
  isHidden?: boolean;
}

export class ResponsiveGridItem extends SceneObjectBase<ResponsiveGridItemState> implements DashboardLayoutItem {
  public static Component = ResponsiveGridItemRenderer;
  private _prevRepeatValues?: VariableValueSingle[];
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: this.state.variableName ? [this.state.variableName] : [],
    onVariableUpdateCompleted: () => this.performRepeat(),
  });
  public readonly isDashboardLayoutItem = true;

  public constructor(state: ResponsiveGridItemState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  public containerRef = React.createRef<HTMLDivElement>();

  private _activationHandler() {
    if (this.state.variableName) {
      this.performRepeat();
    }
  }

  public getOptions(): OptionsPaneCategoryDescriptor {
    return getOptions(this);
  }

  public toggleHideWhenNoData() {
    this.setState({ hideWhenNoData: !this.state.hideWhenNoData });
  }

  public setBody(body: SceneObject): void {
    if (body instanceof VizPanel) {
      this.setState({ body });
    }
  }

  public getVizPanel() {
    return this.state.body;
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
    const stateUpdate: Partial<ResponsiveGridItemState> = { variableName };

    if (this.state.body.state.$variables) {
      this.state.body.setState({ $variables: undefined });
    }

    this._variableDependency.setVariableNames(variableName ? [variableName] : []);

    this.setState(stateUpdate);
    this.performRepeat();
  }

  public cachedBoundingBox: Rect | undefined;
  public computeBoundingBox(): Rect {
    const itemContainer = this.containerRef.current;
    if (!itemContainer || this.state.isHidden) {
      // We can't actually calculate the dimensions of the rendered grid item :(
      throw new Error('Unable to compute bounding box.');
    }

    const { top, left, bottom, right } = itemContainer.getBoundingClientRect();

    return {
      top,
      left,
      bottom,
      right,
    };
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

    // const { scrollTop } = closestScroll(itemContainer);
    const { distance } = closestPoint(point, ...corners);
    return distance;
  }

  toIntermediate(): IntermediateLayoutItem {
    const gridItem = this.containerRef.current;

    if (!gridItem) {
      throw new Error('Grid item not found. Unable to convert to intermediate representation');
    }

    const layout = closestOfType(this, (o) => o instanceof ResponsiveGridLayout);

    if (!layout) {
      console.warn('Unable to find parent layout');
    }

    // calculate origin and bounding box of layout item
    const rect = gridItem.getBoundingClientRect();
    const dataOrder = gridItem.getAttribute('data-order');
    const order = Number.parseInt(dataOrder ?? '-1', 10);

    return {
      body: this.state.body,
      origin: {
        x: rect.left,
        y: rect.top,
      },
      width: rect.width,
      height: rect.height,
      order,
    };
  }
}

// function getStyles(theme: GrafanaTheme2, state: ResponsiveGridItemState) {
//   return {
//     wrapper: css({
//       gridColumn: state.gridColumn || 'unset',
//       gridRow: state.gridRow || 'unset',
//       position: 'relative',
//     }),
//   };
// }

export function closestScroll(el?: HTMLElement | null): {
  scrollTop: number;
  scrollTopMax: number;
  wrapper?: HTMLElement | null;
} {
  if (el && canScroll(el)) {
    return { scrollTop: el.scrollTop, scrollTopMax: el.scrollHeight - el.clientHeight - 5, wrapper: el };
  }

  return el ? closestScroll(el.parentElement) : { scrollTop: 0, scrollTopMax: 0, wrapper: el };
}

function canScroll(el: HTMLElement) {
  const oldScroll = el.scrollTop;
  el.scrollTop = Number.MAX_SAFE_INTEGER;
  const newScroll = el.scrollTop;
  el.scrollTop = oldScroll;

  return newScroll > 0;
}

function euclideanDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
