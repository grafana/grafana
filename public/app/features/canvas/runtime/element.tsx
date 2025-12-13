import * as React from 'react';
import { CSSProperties } from 'react';
import { OnDrag, OnResize, OnRotate } from 'react-moveable/declaration/types';

import {
  FieldType,
  getLinksSupplier,
  LinkModel,
  ScopedVars,
  ValueLinkConfig,
  OneClickMode,
  ActionModel,
  ActionVariableInput,
  ActionType,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  PositionDimensionConfig,
  PositionDimensionMode,
  ScalarDimensionMode,
  TooltipDisplayMode,
} from '@grafana/schema';
import { ConfirmModal, VariablesInputModal } from '@grafana/ui';
import { LayerElement } from 'app/core/components/Layers/types';
import { config } from 'app/core/config';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { DimensionContext } from 'app/features/dimensions/context';
import {
  BackgroundImageSize,
  Constraint,
  HorizontalConstraint,
  Placement,
  VerticalConstraint,
} from 'app/plugins/panel/canvas/panelcfg.gen';
import {
  applyStyles,
  getConnectionsByTarget,
  getRowIndex,
  isConnectionTarget,
  removeStyles,
} from 'app/plugins/panel/canvas/utils';

import { reportActionTrigger } from '../../actions/analytics';
import { getActions, getActionsDefaultField, isInfinityActionWithAuth } from '../../actions/utils';
import { CanvasElementItem, CanvasElementOptions } from '../element';
import { canvasElementRegistry } from '../registry';

import { FrameState } from './frame';
import { RootElement } from './root';
import { Scene } from './scene';

let counter = 0;

export const SVGElements = new Set<string>(['parallelogram', 'triangle', 'cloud', 'ellipse']);

export class ElementState implements LayerElement {
  // UID necessary for moveable to work (for now)
  readonly UID = counter++;
  revId = 0;
  sizeStyle: CSSProperties = {};
  dataStyle: CSSProperties = {};

  // Temp stored constraint for visualization purposes (switch to top / left constraint to simplify some functionality)
  tempConstraint: Constraint | undefined;

  // Filled in by ref
  div?: HTMLDivElement;

  // Calculated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any; // depends on the type

  getLinks?: (config: ValueLinkConfig) => LinkModel[];

  // cached for tooltips/mousemove
  oneClickMode = OneClickMode.Off;
  showActionConfirmation = false;

  showActionVarsModal = false;
  actionVars: ActionVariableInput = {};

  // Cached values resolved from dimension context
  private cachedRotation = 0;
  private cachedTop = 0;
  private cachedLeft = 0;
  private cachedWidth = 100;
  private cachedHeight = 100;
  private cachedRight?: number;
  private cachedBottom?: number;

  /** Check if a position property is field-driven (not fixed) */
  isPositionFieldDriven(prop: 'top' | 'left' | 'width' | 'height' | 'right' | 'bottom'): boolean {
    const pos = this.options.placement?.[prop];
    return pos?.mode === PositionDimensionMode.Field && !!pos?.field;
  }

  /** Check if rotation is field-driven (has a field binding) */
  isRotationFieldDriven(): boolean {
    const rot = this.options.placement?.rotation;
    return !!rot?.field;
  }

  /** Check if ANY position/size property is field-driven - if so, element can't be moved in editor */
  hasFieldDrivenPosition(): boolean {
    return (
      this.isPositionFieldDriven('top') ||
      this.isPositionFieldDriven('left') ||
      this.isPositionFieldDriven('width') ||
      this.isPositionFieldDriven('height') ||
      this.isPositionFieldDriven('right') ||
      this.isPositionFieldDriven('bottom') ||
      this.isRotationFieldDriven()
    );
  }

  setActionVars = (vars: ActionVariableInput) => {
    this.actionVars = vars;
    this.forceUpdate();
  };

  constructor(
    public item: CanvasElementItem,
    public options: CanvasElementOptions,
    public parent?: FrameState
  ) {
    const fallbackName = `Element ${Date.now()}`;
    if (!options) {
      this.options = { type: item.id, name: fallbackName };
    }

    options.constraint = options.constraint ?? {
      vertical: VerticalConstraint.Top,
      horizontal: HorizontalConstraint.Left,
    };
    options.placement = options.placement ?? {
      width: { fixed: 100, mode: PositionDimensionMode.Fixed },
      height: { fixed: 100, mode: PositionDimensionMode.Fixed },
      top: { fixed: 0, mode: PositionDimensionMode.Fixed },
      left: { fixed: 0, mode: PositionDimensionMode.Fixed },
      rotation: { fixed: 0, min: 0, max: 360, mode: ScalarDimensionMode.Clamped },
    };
    options.background = options.background ?? { color: { fixed: 'transparent' } };
    options.border = options.border ?? { color: { fixed: 'dark-green' } };

    const scene = this.getScene();
    if (!options.name) {
      const newName = scene?.getNextElementName();
      options.name = newName ?? fallbackName;
    }
    scene?.byName.set(options.name, this);
  }

  private getScene(): Scene | undefined {
    let trav = this.parent;
    while (trav) {
      if (trav.isRoot()) {
        return trav.scene;
      }
      trav = trav.parent;
    }

    return undefined;
  }

  getName() {
    return this.options.name;
  }

  /** Get the current rotation value (resolved from dimension context) */
  getRotation(): number {
    return this.cachedRotation;
  }

  /** Set the fixed value of a PositionDimensionConfig */
  private setPositionFixed(pos: PositionDimensionConfig | undefined, value: number): void {
    if (pos) {
      pos.fixed = value;
    }
  }

  /** Use the configured options to update CSS style properties directly on the wrapper div **/
  applyLayoutStylesToDiv(disablePointerEvents?: boolean) {
    if (config.featureToggles.canvasPanelPanZoom) {
      this.applyLayoutStylesToDiv2(disablePointerEvents);
      return;
    }
    if (this.isRoot()) {
      // Root supersedes layout engine and is always 100% width + height of panel
      return;
    }

    const { constraint } = this.options;
    const { vertical, horizontal } = constraint ?? {};

    const editingEnabled = this.getScene()?.isEditingEnabled;

    const style: React.CSSProperties = {
      cursor: editingEnabled ? 'grab' : 'auto',
      pointerEvents: disablePointerEvents ? 'none' : 'auto',
      position: 'absolute',
      // Minimum element size is 10x10
      minWidth: '10px',
      minHeight: '10px',
      rotate: `${this.cachedRotation}deg`,
    };

    const translate = ['0px', '0px'];

    switch (vertical) {
      case VerticalConstraint.Top:
        style.top = `${this.cachedTop}px`;
        style.height = `${this.cachedHeight}px`;
        break;
      case VerticalConstraint.Bottom:
        style.bottom = `${this.cachedBottom ?? 0}px`;
        style.height = `${this.cachedHeight}px`;
        break;
      case VerticalConstraint.TopBottom:
        style.top = `${this.cachedTop}px`;
        style.bottom = `${this.cachedBottom ?? 0}px`;
        style.height = '';
        break;
      case VerticalConstraint.Center:
        translate[1] = '-50%';
        style.top = `calc(50% - ${this.cachedTop}px)`;
        style.height = `${this.cachedHeight}px`;
        break;
      case VerticalConstraint.Scale:
        style.top = `${this.cachedTop}%`;
        style.bottom = `${this.cachedBottom ?? 0}%`;
        style.height = '';
        break;
    }

    switch (horizontal) {
      case HorizontalConstraint.Left:
        style.left = `${this.cachedLeft}px`;
        style.width = `${this.cachedWidth}px`;
        break;
      case HorizontalConstraint.Right:
        style.right = `${this.cachedRight ?? 0}px`;
        style.width = `${this.cachedWidth}px`;
        break;
      case HorizontalConstraint.LeftRight:
        style.left = `${this.cachedLeft}px`;
        style.right = `${this.cachedRight ?? 0}px`;
        style.width = '';
        break;
      case HorizontalConstraint.Center:
        translate[0] = '-50%';
        style.left = `calc(50% - ${this.cachedLeft}px)`;
        style.width = `${this.cachedWidth}px`;
        break;
      case HorizontalConstraint.Scale:
        style.left = `${this.cachedLeft}%`;
        style.right = `${this.cachedRight ?? 0}%`;
        style.width = '';
        break;
    }

    style.transform = `translate(${translate[0]}, ${translate[1]})`;
    this.sizeStyle = style;

    if (this.div) {
      applyStyles(this.sizeStyle, this.div);

      // TODO: This is a hack, we should have a better way to handle this
      const elementType = this.options.type;
      if (!SVGElements.has(elementType)) {
        // apply styles to div if it's not an SVG element
        applyStyles(this.dataStyle, this.div);
      } else {
        // ELEMENT IS SVG
        // clean data styles from div if it's an SVG element; SVG elements have their own data styles;
        // this is necessary for changing type of element cases;
        // wrapper div element (this.div) doesn't re-render (has static `key` property),
        // so we have to clean styles manually;
        removeStyles(this.dataStyle, this.div);
      }
    }
  }

  /** Use the configured options to update CSS style properties directly on the wrapper div **/
  applyLayoutStylesToDiv2(disablePointerEvents?: boolean) {
    if (this.isRoot()) {
      // Root supersedes layout engine and is always 100% width + height of panel
      return;
    }

    const scene = this.getScene();
    const { width: sceneWidth, height: sceneHeight } = scene ?? {};

    const { constraint } = this.options;
    const { vertical, horizontal } = constraint ?? {};

    const editingEnabled = scene?.isEditingEnabled;

    const style: React.CSSProperties = {
      cursor: editingEnabled ? 'grab' : 'auto',
      pointerEvents: disablePointerEvents ? 'none' : 'auto',
      position: 'absolute',
      minWidth: '10px',
      minHeight: '10px',
    };

    let transformY = '0px';
    let transformX = '0px';

    switch (vertical) {
      case VerticalConstraint.Top:
        transformY = `${this.cachedTop}px`;
        style.height = `${this.cachedHeight}px`;
        break;
      case VerticalConstraint.Bottom:
        transformY = `${sceneHeight! - (this.cachedBottom ?? 0) - this.cachedHeight}px`;
        style.height = `${this.cachedHeight}px`;
        break;
      case VerticalConstraint.TopBottom:
        transformY = `${this.cachedTop}px`;
        style.height = `${sceneHeight! - this.cachedTop - (this.cachedBottom ?? 0)}px`;
        break;
      case VerticalConstraint.Center:
        transformY = `${sceneHeight! / 2 - this.cachedTop - this.cachedHeight / 2}px`;
        style.height = `${this.cachedHeight}px`;
        break;
      case VerticalConstraint.Scale:
        transformY = `${this.cachedTop * (sceneHeight! / 100)}px`;
        style.height = `${sceneHeight! - this.cachedTop * (sceneHeight! / 100) - (this.cachedBottom ?? 0) * (sceneHeight! / 100)}px`;
        break;
    }

    switch (horizontal) {
      case HorizontalConstraint.Left:
        transformX = `${this.cachedLeft}px`;
        style.width = `${this.cachedWidth}px`;
        break;
      case HorizontalConstraint.Right:
        transformX = `${sceneWidth! - (this.cachedRight ?? 0) - this.cachedWidth}px`;
        style.width = `${this.cachedWidth}px`;
        break;
      case HorizontalConstraint.LeftRight:
        transformX = `${this.cachedLeft}px`;
        style.width = `${sceneWidth! - this.cachedLeft - (this.cachedRight ?? 0)}px`;
        break;
      case HorizontalConstraint.Center:
        transformX = `${sceneWidth! / 2 - this.cachedLeft - this.cachedWidth / 2}px`;
        style.width = `${this.cachedWidth}px`;
        break;
      case HorizontalConstraint.Scale:
        transformX = `${this.cachedLeft * (sceneWidth! / 100)}px`;
        style.width = `${sceneWidth! - this.cachedLeft * (sceneWidth! / 100) - (this.cachedRight ?? 0) * (sceneWidth! / 100)}px`;
        break;
    }
    style.transform = `translate(${transformX}, ${transformY}) rotate(${this.cachedRotation}deg)`;
    this.sizeStyle = style;

    if (this.div) {
      applyStyles(this.sizeStyle, this.div);

      // TODO: This is a hack, we should have a better way to handle this
      const elementType = this.options.type;
      if (!SVGElements.has(elementType)) {
        // apply styles to div if it's not an SVG element
        applyStyles(this.dataStyle, this.div);
      } else {
        // ELEMENT IS SVG
        // clean data styles from div if it's an SVG element; SVG elements have their own data styles;
        // this is necessary for changing type of element cases;
        // wrapper div element (this.div) doesn't re-render (has static `key` property),
        // so we have to clean styles manually;
        removeStyles(this.dataStyle, this.div);
      }
    }
  }

  getTopLeftValues(element: Element) {
    const style = window.getComputedStyle(element);
    const matrix = new DOMMatrix(style.transform || '');
    return {
      left: matrix.m41,
      top: matrix.m42,
      width: style.width ? parseFloat(style.width) : element.clientWidth,
      height: style.height ? parseFloat(style.height) : element.clientHeight,
    }; // m41 = translateX, m42 = translateY
  }

  setPlacementFromConstraint(elementContainer?: DOMRect, parentContainer?: DOMRect, transformScale = 1) {
    if (config.featureToggles.canvasPanelPanZoom) {
      this.setPlacementFromConstraint2(elementContainer, parentContainer, transformScale);
      return;
    }
    const { constraint } = this.options;
    const { vertical, horizontal } = constraint ?? {};

    if (!elementContainer) {
      elementContainer = this.div && this.div.getBoundingClientRect();
    }
    let parentBorderWidth = 0;
    if (!parentContainer) {
      parentContainer = this.div && this.div.parentElement?.getBoundingClientRect();
      parentBorderWidth = this.parent?.isRoot()
        ? 0
        : parseFloat(getComputedStyle(this.div?.parentElement!).borderWidth);
    }

    // For elements with rotation, a delta needs to be applied to account for bounding box rotation
    // TODO: Fix behavior for top+bottom, left+right, center, and scale constraints
    let rotationTopOffset = 0;
    let rotationLeftOffset = 0;
    if (this.cachedRotation && this.options.placement?.width && this.options.placement?.height) {
      const rotationDegrees = this.cachedRotation;
      const rotationRadians = (Math.PI / 180) * rotationDegrees;
      let rotationOffset = rotationRadians;

      switch (true) {
        case rotationDegrees >= 0 && rotationDegrees < 90:
          // no-op
          break;
        case rotationDegrees >= 90 && rotationDegrees < 180:
          rotationOffset = Math.PI - rotationRadians;
          break;
        case rotationDegrees >= 180 && rotationDegrees < 270:
          rotationOffset = Math.PI + rotationRadians;
          break;
        case rotationDegrees >= 270:
          rotationOffset = -rotationRadians;
          break;
      }

      const calculateDelta = (dimension1: number, dimension2: number) =>
        (dimension1 / 2) * Math.sin(rotationOffset) + (dimension2 / 2) * (Math.cos(rotationOffset) - 1);

      rotationTopOffset = calculateDelta(this.cachedWidth, this.cachedHeight);
      rotationLeftOffset = calculateDelta(this.cachedHeight, this.cachedWidth);
    }

    const relativeTop =
      elementContainer && parentContainer
        ? Math.round(elementContainer.top - parentContainer.top - parentBorderWidth + rotationTopOffset) /
          transformScale
        : 0;
    const relativeBottom =
      elementContainer && parentContainer
        ? Math.round(parentContainer.bottom - parentBorderWidth - elementContainer.bottom + rotationTopOffset) /
          transformScale
        : 0;
    const relativeLeft =
      elementContainer && parentContainer
        ? Math.round(elementContainer.left - parentContainer.left - parentBorderWidth + rotationLeftOffset) /
          transformScale
        : 0;
    const relativeRight =
      elementContainer && parentContainer
        ? Math.round(parentContainer.right - parentBorderWidth - elementContainer.right + rotationLeftOffset) /
          transformScale
        : 0;

    // Don't update placement if any position is field-driven
    if (this.hasFieldDrivenPosition()) {
      this.applyLayoutStylesToDiv();
      this.revId++;
      return;
    }

    const width = (elementContainer?.width ?? 100) / transformScale;
    const height = (elementContainer?.height ?? 100) / transformScale;

    // Helper to create a position dimension config
    const fixedPosition = (value: number): PositionDimensionConfig => ({
      fixed: value,
      mode: PositionDimensionMode.Fixed,
    });

    const placement: Placement = {};

    switch (vertical) {
      case VerticalConstraint.Top:
        placement.top = fixedPosition(relativeTop);
        placement.height = fixedPosition(height);
        this.cachedTop = relativeTop;
        this.cachedHeight = height;
        break;
      case VerticalConstraint.Bottom:
        placement.bottom = fixedPosition(relativeBottom);
        placement.height = fixedPosition(height);
        this.cachedBottom = relativeBottom;
        this.cachedHeight = height;
        break;
      case VerticalConstraint.TopBottom:
        placement.top = fixedPosition(relativeTop);
        placement.bottom = fixedPosition(relativeBottom);
        this.cachedTop = relativeTop;
        this.cachedBottom = relativeBottom;
        break;
      case VerticalConstraint.Center:
        const elementCenterV = elementContainer ? relativeTop + height / 2 : 0;
        const parentCenterV = parentContainer ? parentContainer.height / 2 : 0;
        const distanceFromCenterV = parentCenterV - elementCenterV;
        placement.top = fixedPosition(distanceFromCenterV);
        placement.height = fixedPosition(height);
        this.cachedTop = distanceFromCenterV;
        this.cachedHeight = height;
        break;
      case VerticalConstraint.Scale:
        const scaleTop = (relativeTop / (parentContainer?.height ?? height)) * 100 * transformScale;
        const scaleBottom = (relativeBottom / (parentContainer?.height ?? height)) * 100 * transformScale;
        placement.top = fixedPosition(scaleTop);
        placement.bottom = fixedPosition(scaleBottom);
        this.cachedTop = scaleTop;
        this.cachedBottom = scaleBottom;
        break;
    }

    switch (horizontal) {
      case HorizontalConstraint.Left:
        placement.left = fixedPosition(relativeLeft);
        placement.width = fixedPosition(width);
        this.cachedLeft = relativeLeft;
        this.cachedWidth = width;
        break;
      case HorizontalConstraint.Right:
        placement.right = fixedPosition(relativeRight);
        placement.width = fixedPosition(width);
        this.cachedRight = relativeRight;
        this.cachedWidth = width;
        break;
      case HorizontalConstraint.LeftRight:
        placement.left = fixedPosition(relativeLeft);
        placement.right = fixedPosition(relativeRight);
        this.cachedLeft = relativeLeft;
        this.cachedRight = relativeRight;
        break;
      case HorizontalConstraint.Center:
        const elementCenterH = elementContainer ? relativeLeft + width / 2 : 0;
        const parentCenterH = parentContainer ? parentContainer.width / 2 : 0;
        const distanceFromCenterH = parentCenterH - elementCenterH;
        placement.left = fixedPosition(distanceFromCenterH);
        placement.width = fixedPosition(width);
        this.cachedLeft = distanceFromCenterH;
        this.cachedWidth = width;
        break;
      case HorizontalConstraint.Scale:
        const scaleLeft = (relativeLeft / (parentContainer?.width ?? width)) * 100 * transformScale;
        const scaleRight = (relativeRight / (parentContainer?.width ?? width)) * 100 * transformScale;
        placement.left = fixedPosition(scaleLeft);
        placement.right = fixedPosition(scaleRight);
        this.cachedLeft = scaleLeft;
        this.cachedRight = scaleRight;
        break;
    }

    // Preserve rotation
    if (this.options.placement?.rotation) {
      placement.rotation = this.options.placement.rotation;
    }

    this.options.placement = placement;

    this.applyLayoutStylesToDiv();
    this.revId++;

    this.getScene()?.save();
  }

  setPlacementFromConstraint2(elementContainer?: DOMRect, parentContainer?: DOMRect, transformScale = 1) {
    const scene = this.getScene()!;
    const { constraint } = this.options;
    const { vertical, horizontal } = constraint ?? {};

    const elementRect = this.getTopLeftValues(this.div!);

    if (!elementContainer) {
      elementContainer = this.div && this.div.getBoundingClientRect();
    }
    // let parentBorderWidth = 0;
    if (!parentContainer) {
      parentContainer = this.div && this.div.parentElement?.getBoundingClientRect();
    }

    const relativeTop = Math.round(elementRect.top);
    const relativeBottom = Math.round(scene.height - elementRect.top - elementRect.height);
    const relativeLeft = Math.round(elementRect.left);
    const relativeRight = Math.round(scene.width - elementRect.left - elementRect.width);

    // Don't update placement if any position is field-driven
    if (this.hasFieldDrivenPosition()) {
      this.applyLayoutStylesToDiv();
      this.revId++;
      return;
    }

    const width = elementRect.width;
    const height = elementRect.height;

    // Helper to create a position dimension config
    const fixedPosition = (value: number): PositionDimensionConfig => ({
      fixed: value,
      mode: PositionDimensionMode.Fixed,
    });

    const placement: Placement = {};

    // INFO: calculate for pan&zoom
    placement.top = fixedPosition(relativeTop);
    placement.left = fixedPosition(relativeLeft);
    this.cachedTop = relativeTop;
    this.cachedLeft = relativeLeft;

    switch (vertical) {
      case VerticalConstraint.Top:
        placement.top = fixedPosition(relativeTop);
        placement.height = fixedPosition(height);
        this.cachedTop = relativeTop;
        this.cachedHeight = height;
        break;
      case VerticalConstraint.Bottom:
        placement.bottom = fixedPosition(relativeBottom);
        placement.height = fixedPosition(height);
        this.cachedBottom = relativeBottom;
        this.cachedHeight = height;
        break;
      case VerticalConstraint.TopBottom:
        placement.top = fixedPosition(relativeTop);
        placement.bottom = fixedPosition(relativeBottom);
        this.cachedTop = relativeTop;
        this.cachedBottom = relativeBottom;
        break;
      case VerticalConstraint.Center:
        const elementCenterV = elementContainer ? relativeTop + height / 2 : 0;
        const parentCenterV = scene.height / 2;
        const distanceFromCenterV = parentCenterV - elementCenterV;
        placement.top = fixedPosition(distanceFromCenterV);
        placement.height = fixedPosition(height);
        this.cachedTop = distanceFromCenterV;
        this.cachedHeight = height;
        break;
      case VerticalConstraint.Scale:
        const scaleTop = (relativeTop / (parentContainer?.height ?? height)) * 100 * transformScale;
        const scaleBottom = (relativeBottom / (parentContainer?.height ?? height)) * 100 * transformScale;
        placement.top = fixedPosition(scaleTop);
        placement.bottom = fixedPosition(scaleBottom);
        this.cachedTop = scaleTop;
        this.cachedBottom = scaleBottom;
        break;
    }

    switch (horizontal) {
      case HorizontalConstraint.Left:
        placement.left = fixedPosition(relativeLeft);
        placement.width = fixedPosition(width);
        this.cachedLeft = relativeLeft;
        this.cachedWidth = width;
        break;
      case HorizontalConstraint.Right:
        placement.right = fixedPosition(relativeRight);
        placement.width = fixedPosition(width);
        this.cachedRight = relativeRight;
        this.cachedWidth = width;
        break;
      case HorizontalConstraint.LeftRight:
        placement.left = fixedPosition(relativeLeft);
        placement.right = fixedPosition(relativeRight);
        this.cachedLeft = relativeLeft;
        this.cachedRight = relativeRight;
        break;
      case HorizontalConstraint.Center:
        const elementCenterH = elementContainer ? relativeLeft + width / 2 : 0;
        const parentCenterH = scene.width / 2;
        const distanceFromCenterH = parentCenterH - elementCenterH;
        placement.left = fixedPosition(distanceFromCenterH);
        placement.width = fixedPosition(width);
        this.cachedLeft = distanceFromCenterH;
        this.cachedWidth = width;
        break;
      case HorizontalConstraint.Scale:
        const scaleLeft = (relativeLeft / (parentContainer?.width ?? width)) * 100 * transformScale;
        const scaleRight = (relativeRight / (parentContainer?.width ?? width)) * 100 * transformScale;
        placement.left = fixedPosition(scaleLeft);
        placement.right = fixedPosition(scaleRight);
        this.cachedLeft = scaleLeft;
        this.cachedRight = scaleRight;
        break;
    }

    // Preserve rotation
    if (this.options.placement?.rotation) {
      placement.rotation = this.options.placement.rotation;
    }

    this.options.placement = placement;

    this.applyLayoutStylesToDiv();
    this.revId++;

    this.getScene()?.save();
  }

  updateData(ctx: DimensionContext) {
    const previousData = this.data;

    if (this.item.prepareData) {
      this.data = this.item.prepareData(ctx, this.options);

      // Only increment revId if data actually changed (not just position)
      // This prevents flickering when only position updates
      if (JSON.stringify(this.data) !== JSON.stringify(previousData)) {
        this.revId++;
      }
    }

    // Update placement values from dimension context
    const placement = this.options.placement;
    if (placement) {
      if (placement.rotation) {
        this.cachedRotation = ctx.getScalar(placement.rotation).value();
      }
      if (placement.top) {
        this.cachedTop = ctx.getPosition(placement.top).value();
      }
      if (placement.left) {
        this.cachedLeft = ctx.getPosition(placement.left).value();
      }
      if (placement.width) {
        this.cachedWidth = ctx.getPosition(placement.width).value();
      }
      if (placement.height) {
        this.cachedHeight = ctx.getPosition(placement.height).value();
      }
      if (placement.right) {
        this.cachedRight = ctx.getPosition(placement.right).value();
      }
      if (placement.bottom) {
        this.cachedBottom = ctx.getPosition(placement.bottom).value();
      }
    }

    // Apply updated positions without forcing a remount
    this.applyLayoutStylesToDiv();

    const scene = this.getScene();
    const frames = scene?.data?.series;

    this.options.links = this.options.links?.filter((link) => link !== null);

    if (this.options.links?.some((link) => link.oneClick === true)) {
      this.oneClickMode = OneClickMode.Link;
    } else if (
      this.options.actions
        ?.filter((action) => action.type === ActionType.Fetch || isInfinityActionWithAuth(action))
        .some((action) => action.oneClick)
    ) {
      const scene = this.getScene();
      const canExecuteActions = scene?.panel?.panelContext?.canExecuteActions;
      const userCanExecuteActions = canExecuteActions?.() ?? false;

      this.oneClickMode = userCanExecuteActions ? OneClickMode.Action : OneClickMode.Off;
    } else {
      this.oneClickMode = OneClickMode.Off;
    }

    if (frames) {
      const defaultField = {
        name: 'Default field',
        type: FieldType.string,
        config: { links: this.options.links ?? [], actions: this.options.actions ?? [] },
        values: [],
      };

      this.getLinks = getLinksSupplier(
        frames[0],
        defaultField,
        {
          __dataContext: {
            value: {
              data: frames,
              field: defaultField,
              frame: frames[0],
              frameIndex: 0,
            },
          },
        },
        scene?.panel.props.replaceVariables!
      );
    }

    const { background, border } = this.options;
    const css: CSSProperties = {};
    if (background) {
      if (background.color) {
        const color = ctx.getColor(background.color);
        css.backgroundColor = color.value();
      }
      if (background.image) {
        const image = ctx.getResource(background.image);
        if (image) {
          const v = image.value();
          if (v) {
            css.backgroundImage = `url("${v}")`;
            switch (background.size ?? BackgroundImageSize.Contain) {
              case BackgroundImageSize.Contain:
                css.backgroundSize = 'contain';
                css.backgroundRepeat = 'no-repeat';
                break;
              case BackgroundImageSize.Cover:
                css.backgroundSize = 'cover';
                css.backgroundRepeat = 'no-repeat';
                break;
              case BackgroundImageSize.Original:
                css.backgroundRepeat = 'no-repeat';
                break;
              case BackgroundImageSize.Tile:
                css.backgroundRepeat = 'repeat';
                break;
              case BackgroundImageSize.Fill:
                css.backgroundSize = '100% 100%';
                break;
            }
          } else {
            css.backgroundImage = '';
          }
        }
      }
    }

    if (border && border.color && border.width !== undefined) {
      const color = ctx.getColor(border.color);
      css.borderWidth = `${border.width}px`;
      css.borderStyle = 'solid';
      css.borderColor = color.value();

      // Move the image to inside the border
      if (css.backgroundImage) {
        css.backgroundOrigin = 'padding-box';
      }
    }

    if (border && border.radius !== undefined) {
      css.borderRadius = `${border.radius}px`;
    }

    this.dataStyle = css;
    this.applyLayoutStylesToDiv();
  }

  isRoot(): this is RootElement {
    return false;
  }

  /** Recursively visit all nodes */
  visit(visitor: (v: ElementState) => void) {
    visitor(this);
  }

  onChange(options: CanvasElementOptions) {
    if (this.item.id !== options.type) {
      this.item = canvasElementRegistry.getIfExists(options.type) ?? notFoundItem;
    }

    // rename handling
    const oldName = this.options.name;
    const newName = options.name;

    this.revId++;
    this.options = { ...options };
    let trav = this.parent;
    while (trav) {
      if (trav.isRoot()) {
        trav.scene.save();
        break;
      }
      trav.revId++;
      trav = trav.parent;
    }

    const scene = this.getScene();
    if (oldName !== newName && scene) {
      if (isConnectionTarget(this, scene.byName)) {
        getConnectionsByTarget(this, scene).forEach((connection) => {
          connection.info.targetName = newName;
        });
      }

      scene.byName.delete(oldName);
      scene.byName.set(newName, this);
    }
  }

  getSaveModel() {
    return { ...this.options };
  }

  initElement = (target: HTMLDivElement) => {
    this.div = target;
    this.applyLayoutStylesToDiv();
  };

  applyDrag = (event: OnDrag) => {
    // Don't allow dragging if any position is field-driven
    if (this.hasFieldDrivenPosition()) {
      return;
    }

    const hasHorizontalCenterConstraint = this.options.constraint?.horizontal === HorizontalConstraint.Center;
    const hasVerticalCenterConstraint = this.options.constraint?.vertical === VerticalConstraint.Center;
    if (hasHorizontalCenterConstraint || hasVerticalCenterConstraint) {
      const numberOfTargets = this.getScene()?.selecto?.getSelectedTargets().length ?? 0;
      const isMultiSelection = numberOfTargets > 1;
      if (!isMultiSelection) {
        const elementContainer = this.div?.getBoundingClientRect();
        const height = elementContainer?.height ?? 100;
        const yOffset = hasVerticalCenterConstraint ? height / 4 : 0;
        event.target.style.transform = `translate(${event.translate[0]}px, ${event.translate[1] - yOffset}px)`;
        return;
      }
    }

    event.target.style.transform = event.transform;
  };

  applyRotate = (event: OnRotate) => {
    const rotationDelta = event.delta;
    const placement = this.options.placement!;
    const placementRotation = this.cachedRotation;

    const calculatedRotation = placementRotation + rotationDelta;

    // Ensure rotation is between 0 and 360
    const newRotation = calculatedRotation - Math.floor(calculatedRotation / 360) * 360;

    // Update the config value as fixed
    if (!placement.rotation) {
      placement.rotation = { fixed: newRotation, min: 0, max: 360, mode: ScalarDimensionMode.Clamped };
    } else {
      placement.rotation.fixed = newRotation;
    }
    this.cachedRotation = newRotation;
    event.target.style.transform = event.transform;
  };

  // kinda like:
  // https://github.com/grafana/grafana-edge-app/blob/main/src/panels/draw/WrapItem.tsx#L44
  applyResize = (event: OnResize) => {
    // Don't allow resizing if any position is field-driven
    if (this.hasFieldDrivenPosition()) {
      return;
    }

    const placement = this.options.placement!;

    const style = event.target.style;
    let deltaX = event.delta[0];
    let deltaY = event.delta[1];
    let dirLR = event.direction[0];
    let dirTB = event.direction[1];

    // Handle case when element is rotated
    if (this.cachedRotation) {
      const rotation = this.cachedRotation;
      const rotationInRadians = (rotation * Math.PI) / 180;
      const originalDirLR = dirLR;
      const originalDirTB = dirTB;

      dirLR = Math.sign(originalDirLR * Math.cos(rotationInRadians) - originalDirTB * Math.sin(rotationInRadians));
      dirTB = Math.sign(originalDirLR * Math.sin(rotationInRadians) + originalDirTB * Math.cos(rotationInRadians));
    }

    if (dirLR === 1) {
      this.setPositionFixed(placement.width, event.width);
      this.cachedWidth = event.width;
      style.width = `${this.cachedWidth}px`;
    } else if (dirLR === -1) {
      this.cachedLeft -= deltaX;
      this.setPositionFixed(placement.left, this.cachedLeft);
      this.cachedWidth = event.width;
      this.setPositionFixed(placement.width, this.cachedWidth);
      if (config.featureToggles.canvasPanelPanZoom) {
        style.transform = `translate(${this.cachedLeft}px, ${this.cachedTop}px) rotate(${this.cachedRotation}deg)`;
      } else {
        style.left = `${this.cachedLeft}px`;
      }
      style.width = `${this.cachedWidth}px`;
    }

    if (dirTB === -1) {
      this.cachedTop -= deltaY;
      this.setPositionFixed(placement.top, this.cachedTop);
      this.cachedHeight = event.height;
      this.setPositionFixed(placement.height, this.cachedHeight);
      if (config.featureToggles.canvasPanelPanZoom) {
        style.transform = `translate(${this.cachedLeft}px, ${this.cachedTop}px) rotate(${this.cachedRotation}deg)`;
      } else {
        style.top = `${this.cachedTop}px`;
      }
      style.height = `${this.cachedHeight}px`;
    } else if (dirTB === 1) {
      this.cachedHeight = event.height;
      this.setPositionFixed(placement.height, this.cachedHeight);
      style.height = `${this.cachedHeight}px`;
    }
  };

  handleMouseEnter = (event: React.MouseEvent, isSelected: boolean | undefined) => {
    const scene = this.getScene();

    const shouldHandleTooltip =
      !scene?.isEditingEnabled && (!scene?.tooltipPayload?.isOpen || scene?.tooltipPayload?.element === this);
    if (shouldHandleTooltip) {
      this.handleTooltip(event);
    } else if (!isSelected && !this.hasFieldDrivenPosition()) {
      // Don't show connection anchors for field-driven elements
      scene?.connections.handleMouseEnter(event);
    }

    if (this.div != null) {
      if (this.oneClickMode === OneClickMode.Link) {
        const primaryDataLink = this.getPrimaryDataLink();
        if (primaryDataLink) {
          this.div.style.cursor = 'pointer';
          this.div.title = `Navigate to ${primaryDataLink.title === '' ? 'data link' : primaryDataLink.title}`;
        }
      } else if (this.oneClickMode === OneClickMode.Action) {
        const primaryAction = this.getPrimaryAction();
        if (primaryAction) {
          this.div.style.cursor = 'pointer';
          this.div.title = primaryAction.title;
        }
      }
    }
  };

  getPrimaryDataLink = () => {
    if (this.getLinks) {
      const links = this.getLinks({ valueRowIndex: getRowIndex(this.data.field, this.getScene()!) });
      return links.find((link) => link.oneClick === true);
    }

    return undefined;
  };

  getPrimaryAction = () => {
    const scene = this.getScene();
    const canExecuteActions = scene?.panel?.panelContext?.canExecuteActions;
    const userCanExecuteActions = canExecuteActions?.() ?? false;

    if (!userCanExecuteActions) {
      return undefined;
    }

    const config: ValueLinkConfig = { valueRowIndex: getRowIndex(this.data.field, scene!) };
    const actionsDefaultFieldConfig = { links: this.options.links ?? [], actions: this.options.actions ?? [] };
    const frames = scene?.data?.series;

    if (frames) {
      const defaultField = getActionsDefaultField(actionsDefaultFieldConfig.links, actionsDefaultFieldConfig.actions);
      const scopedVars: ScopedVars = {
        __dataContext: {
          value: {
            data: frames,
            field: defaultField,
            frame: frames[0],
            frameIndex: 0,
          },
        },
      };

      const actions = getActions(
        frames[0],
        defaultField,
        scopedVars,
        scene?.panel.props.replaceVariables!,
        actionsDefaultFieldConfig.actions,
        config
      );
      return actions.find((action) => action.oneClick === true);
    }

    return undefined;
  };

  handleTooltip = (event: React.MouseEvent) => {
    const scene = this.getScene();
    if (!scene || !scene.tooltipCallback) {
      return;
    }

    const shouldDisableForOneClick = scene.tooltipDisableForOneClick && this.oneClickMode !== OneClickMode.Off;
    const shouldShowTooltip = scene.tooltipMode !== TooltipDisplayMode.None && !shouldDisableForOneClick;

    if (shouldShowTooltip) {
      const rect = this.div?.getBoundingClientRect();
      scene.tooltipCallback({
        anchorPoint: { x: rect?.right ?? event.pageX, y: rect?.top ?? event.pageY },
        element: this,
        isOpen: false,
      });
    }
  };

  handleMouseLeave = (event: React.MouseEvent) => {
    const scene = this.getScene();
    if (scene?.tooltipCallback && !scene?.tooltipPayload?.isOpen) {
      scene.tooltipCallback(undefined);
    }

    if (this.oneClickMode !== OneClickMode.Off && this.div) {
      this.div.style.cursor = 'auto';
      this.div.title = '';
    }
  };

  onElementClick = (event: React.MouseEvent) => {
    // If one-click access is enabled, open the primary link
    if (this.oneClickMode === OneClickMode.Link) {
      let primaryDataLink = this.getPrimaryDataLink();
      if (primaryDataLink) {
        window.open(primaryDataLink.href, primaryDataLink.target ?? '_self');
      }
    } else if (this.oneClickMode === OneClickMode.Action) {
      const primaryAction = this.getPrimaryAction();
      const actionHasVariables = primaryAction?.variables && primaryAction.variables.length > 0;

      if (actionHasVariables) {
        this.showActionVarsModal = true;
        this.forceUpdate();
      } else {
        this.showActionConfirmation = true;
        this.forceUpdate();
      }
    } else {
      this.handleTooltip(event);
      this.onTooltipCallback();
    }
  };

  onElementKeyDown = (event: React.KeyboardEvent) => {
    if (
      event.key === 'Enter' &&
      (event.currentTarget instanceof HTMLElement || event.currentTarget instanceof SVGElement)
    ) {
      const scene = this.getScene();
      scene?.select({ targets: [event.currentTarget] });
    }
  };

  onTooltipCallback = () => {
    const scene = this.getScene();
    if (scene?.tooltipCallback && scene.tooltipPayload?.anchorPoint) {
      scene.tooltipCallback({
        anchorPoint: { x: scene.tooltipPayload.anchorPoint.x, y: scene.tooltipPayload.anchorPoint.y },
        element: this,
        isOpen: true,
      });
    }
  };

  forceUpdate = () => {
    const scene = this.getScene();
    if (scene?.actionConfirmationCallback) {
      scene.actionConfirmationCallback();
    }
  };

  renderActionsConfirmModal = (action: ActionModel | undefined) => {
    if (!action) {
      return;
    }

    return (
      <>
        {this.showActionConfirmation && action && (
          <ConfirmModal
            isOpen={true}
            title={t('grafana-ui.action-editor.button.confirm-action', 'Confirm action')}
            body={action.confirmation(/** TODO: implement actionVars */)}
            confirmText={t('grafana-ui.action-editor.button.confirm', 'Confirm')}
            confirmButtonVariant="primary"
            onConfirm={() => {
              this.showActionConfirmation = false;
              action.onClick(new MouseEvent('click'), null, this.actionVars);
              if (action.type) {
                reportActionTrigger(action.type, true, 'canvas');
              }
              this.forceUpdate();
            }}
            onDismiss={() => {
              this.showActionConfirmation = false;
              this.forceUpdate();
            }}
          />
        )}
      </>
    );
  };

  renderVariablesInputModal = (action: ActionModel | undefined) => {
    if (!action || !action.variables || action.variables.length === 0) {
      return;
    }

    const onModalContinue = () => {
      this.showActionVarsModal = false;
      this.showActionConfirmation = true;
      this.forceUpdate();
    };

    return (
      <VariablesInputModal
        action={action}
        variables={this.actionVars}
        setVariables={this.setActionVars}
        onDismiss={() => {
          this.showActionVarsModal = false;
          this.forceUpdate();
        }}
        onShowConfirm={onModalContinue}
      />
    );
  };

  // Track if this field-driven element is selected (for showing outline)
  isFieldDrivenSelected = false;

  setFieldDrivenSelected(selected: boolean) {
    if (this.hasFieldDrivenPosition()) {
      this.isFieldDrivenSelected = selected;
      // Update the outline style
      if (this.div) {
        if (selected) {
          this.div.style.outline = '2px solid #3274d9';
          this.div.style.outlineOffset = '2px';
        } else {
          this.div.style.outline = '';
          this.div.style.outlineOffset = '';
        }
      }
    }
  }

  renderElement() {
    const { item, div } = this;
    const scene = this.getScene();
    const isSelected = div && scene && scene.selecto && scene.selecto.getSelectedTargets().includes(div);

    return (
      <>
        <div
          key={this.UID}
          ref={this.initElement}
          onMouseEnter={(e: React.MouseEvent) => this.handleMouseEnter(e, isSelected)}
          onMouseLeave={!scene?.isEditingEnabled ? this.handleMouseLeave : undefined}
          onClick={!scene?.isEditingEnabled ? this.onElementClick : undefined}
          onKeyDown={!scene?.isEditingEnabled ? this.onElementKeyDown : undefined}
          role="button"
          tabIndex={0}
          style={{ userSelect: 'none' }}
        >
          <item.display
            key={`${this.UID}/${this.revId}`}
            config={this.options.config}
            data={this.data}
            isSelected={isSelected || this.isFieldDrivenSelected}
          />
        </div>
        {this.showActionConfirmation && this.renderActionsConfirmModal(this.getPrimaryAction())}
        {this.showActionVarsModal && this.renderVariablesInputModal(this.getPrimaryAction())}
      </>
    );
  }
}
