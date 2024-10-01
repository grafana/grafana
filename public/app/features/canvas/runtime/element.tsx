import * as React from 'react';
import { CSSProperties } from 'react';
import { OnDrag, OnResize, OnRotate } from 'react-moveable/declaration/types';

import { FieldType, getLinksSupplier, LinkModel, OneClickMode, ScopedVars, ValueLinkConfig } from '@grafana/data';
import { LayerElement } from 'app/core/components/Layers/types';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { DimensionContext } from 'app/features/dimensions';
import {
  BackgroundImageSize,
  Constraint,
  HorizontalConstraint,
  Placement,
  VerticalConstraint,
} from 'app/plugins/panel/canvas/panelcfg.gen';
import { getConnectionsByTarget, getRowIndex, isConnectionTarget } from 'app/plugins/panel/canvas/utils';

import { getActions, getActionsDefaultField } from '../../actions/utils';
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
    options.placement = options.placement ?? { width: 100, height: 100, top: 0, left: 0, rotation: 0 };
    options.background = options.background ?? { color: { fixed: 'transparent' } };
    options.border = options.border ?? { color: { fixed: 'dark-green' } };
    options.oneClickMode = options.oneClickMode ?? OneClickMode.Off;
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

  /** Use the configured options to update CSS style properties directly on the wrapper div **/
  applyLayoutStylesToDiv(disablePointerEvents?: boolean) {
    if (this.isRoot()) {
      // Root supersedes layout engine and is always 100% width + height of panel
      return;
    }

    const { constraint } = this.options;
    const { vertical, horizontal } = constraint ?? {};
    const placement: Placement = this.options.placement ?? {};

    const editingEnabled = this.getScene()?.isEditingEnabled;

    const style: React.CSSProperties = {
      cursor: editingEnabled ? 'grab' : 'auto',
      pointerEvents: disablePointerEvents ? 'none' : 'auto',
      position: 'absolute',
      // Minimum element size is 10x10
      minWidth: '10px',
      minHeight: '10px',
      rotate: `${placement.rotation ?? 0}deg`,
    };

    const translate = ['0px', '0px'];

    switch (vertical) {
      case VerticalConstraint.Top:
        placement.top = placement.top ?? 0;
        placement.height = placement.height ?? 100;
        style.top = `${placement.top}px`;
        style.height = `${placement.height}px`;
        delete placement.bottom;
        break;
      case VerticalConstraint.Bottom:
        placement.bottom = placement.bottom ?? 0;
        placement.height = placement.height ?? 100;
        style.bottom = `${placement.bottom}px`;
        style.height = `${placement.height}px`;
        delete placement.top;
        break;
      case VerticalConstraint.TopBottom:
        placement.top = placement.top ?? 0;
        placement.bottom = placement.bottom ?? 0;
        style.top = `${placement.top}px`;
        style.bottom = `${placement.bottom}px`;
        delete placement.height;
        style.height = '';
        break;
      case VerticalConstraint.Center:
        placement.top = placement.top ?? 0;
        placement.height = placement.height ?? 100;
        translate[1] = '-50%';
        style.top = `calc(50% - ${placement.top}px)`;
        style.height = `${placement.height}px`;
        delete placement.bottom;
        break;
      case VerticalConstraint.Scale:
        placement.top = placement.top ?? 0;
        placement.bottom = placement.bottom ?? 0;
        style.top = `${placement.top}%`;
        style.bottom = `${placement.bottom}%`;
        delete placement.height;
        style.height = '';
        break;
    }

    switch (horizontal) {
      case HorizontalConstraint.Left:
        placement.left = placement.left ?? 0;
        placement.width = placement.width ?? 100;
        style.left = `${placement.left}px`;
        style.width = `${placement.width}px`;
        delete placement.right;
        break;
      case HorizontalConstraint.Right:
        placement.right = placement.right ?? 0;
        placement.width = placement.width ?? 100;
        style.right = `${placement.right}px`;
        style.width = `${placement.width}px`;
        delete placement.left;
        break;
      case HorizontalConstraint.LeftRight:
        placement.left = placement.left ?? 0;
        placement.right = placement.right ?? 0;
        style.left = `${placement.left}px`;
        style.right = `${placement.right}px`;
        delete placement.width;
        style.width = '';
        break;
      case HorizontalConstraint.Center:
        placement.left = placement.left ?? 0;
        placement.width = placement.width ?? 100;
        translate[0] = '-50%';
        style.left = `calc(50% - ${placement.left}px)`;
        style.width = `${placement.width}px`;
        delete placement.right;
        break;
      case HorizontalConstraint.Scale:
        placement.left = placement.left ?? 0;
        placement.right = placement.right ?? 0;
        style.left = `${placement.left}%`;
        style.right = `${placement.right}%`;
        delete placement.width;
        style.width = '';
        break;
    }

    style.transform = `translate(${translate[0]}, ${translate[1]})`;
    this.options.placement = placement;
    this.sizeStyle = style;

    if (this.div) {
      for (const key in this.sizeStyle) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        this.div.style[key as any] = (this.sizeStyle as any)[key];
      }

      // TODO: This is a hack, we should have a better way to handle this
      const elementType = this.options.type;
      if (!SVGElements.has(elementType)) {
        // apply styles to div if it's not an SVG element
        for (const key in this.dataStyle) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
          this.div.style[key as any] = (this.dataStyle as any)[key];
        }
      } else {
        // ELEMENT IS SVG
        // clean data styles from div if it's an SVG element; SVG elements have their own data styles;
        // this is necessary for changing type of element cases;
        // wrapper div element (this.div) doesn't re-render (has static `key` property),
        // so we have to clean styles manually;
        for (const key in this.dataStyle) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
          this.div.style[key as any] = '';
        }
      }
    }
  }

  setPlacementFromConstraint(elementContainer?: DOMRect, parentContainer?: DOMRect, transformScale = 1) {
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
    if (this.options.placement?.rotation && this.options.placement?.width && this.options.placement?.height) {
      const rotationDegrees = this.options.placement.rotation;
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

      rotationTopOffset = calculateDelta(this.options.placement.width, this.options.placement.height);
      rotationLeftOffset = calculateDelta(this.options.placement.height, this.options.placement.width);
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

    const placement: Placement = {};

    const width = (elementContainer?.width ?? 100) / transformScale;
    const height = (elementContainer?.height ?? 100) / transformScale;

    switch (vertical) {
      case VerticalConstraint.Top:
        placement.top = relativeTop;
        placement.height = height;
        break;
      case VerticalConstraint.Bottom:
        placement.bottom = relativeBottom;
        placement.height = height;
        break;
      case VerticalConstraint.TopBottom:
        placement.top = relativeTop;
        placement.bottom = relativeBottom;
        break;
      case VerticalConstraint.Center:
        const elementCenter = elementContainer ? relativeTop + height / 2 : 0;
        const parentCenter = parentContainer ? parentContainer.height / 2 : 0;
        const distanceFromCenter = parentCenter - elementCenter;
        placement.top = distanceFromCenter;
        placement.height = height;
        break;
      case VerticalConstraint.Scale:
        placement.top = (relativeTop / (parentContainer?.height ?? height)) * 100;
        placement.bottom = (relativeBottom / (parentContainer?.height ?? height)) * 100;
        break;
    }

    switch (horizontal) {
      case HorizontalConstraint.Left:
        placement.left = relativeLeft;
        placement.width = width;
        break;
      case HorizontalConstraint.Right:
        placement.right = relativeRight;
        placement.width = width;
        break;
      case HorizontalConstraint.LeftRight:
        placement.left = relativeLeft;
        placement.right = relativeRight;
        break;
      case HorizontalConstraint.Center:
        const elementCenter = elementContainer ? relativeLeft + width / 2 : 0;
        const parentCenter = parentContainer ? parentContainer.width / 2 : 0;
        const distanceFromCenter = parentCenter - elementCenter;
        placement.left = distanceFromCenter;
        placement.width = width;
        break;
      case HorizontalConstraint.Scale:
        placement.left = (relativeLeft / (parentContainer?.width ?? width)) * 100;
        placement.right = (relativeRight / (parentContainer?.width ?? width)) * 100;
        break;
    }

    if (this.options.placement?.rotation) {
      placement.rotation = this.options.placement.rotation;
      placement.width = this.options.placement.width;
      placement.height = this.options.placement.height;
    }

    this.options.placement = placement;

    this.applyLayoutStylesToDiv();
    this.revId++;

    this.getScene()?.save();
  }

  updateData(ctx: DimensionContext) {
    if (this.item.prepareData) {
      this.data = this.item.prepareData(ctx, this.options);
      this.revId++; // rerender
    }

    const scene = this.getScene();
    const frames = scene?.data?.series;

    this.options.links = this.options.links?.filter((link) => link !== null);

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
    const placementRotation = placement.rotation ?? 0;

    const calculatedRotation = placementRotation + rotationDelta;

    // Ensure rotation is between 0 and 360
    placement.rotation = calculatedRotation - Math.floor(calculatedRotation / 360) * 360;
    event.target.style.transform = event.transform;
  };

  // kinda like:
  // https://github.com/grafana/grafana-edge-app/blob/main/src/panels/draw/WrapItem.tsx#L44
  applyResize = (event: OnResize, transformScale = 1) => {
    const placement = this.options.placement!;

    const style = event.target.style;
    let deltaX = event.delta[0] / transformScale;
    let deltaY = event.delta[1] / transformScale;
    let dirLR = event.direction[0];
    let dirTB = event.direction[1];

    // Handle case when element is rotated
    if (placement.rotation) {
      const rotation = placement.rotation ?? 0;
      const rotationInRadians = (rotation * Math.PI) / 180;
      const originalDirLR = dirLR;
      const originalDirTB = dirTB;

      dirLR = Math.sign(originalDirLR * Math.cos(rotationInRadians) - originalDirTB * Math.sin(rotationInRadians));
      dirTB = Math.sign(originalDirLR * Math.sin(rotationInRadians) + originalDirTB * Math.cos(rotationInRadians));
    }

    if (dirLR === 1) {
      placement.width = event.width;
      style.width = `${placement.width}px`;
    } else if (dirLR === -1) {
      placement.left! -= deltaX;
      placement.width = event.width;
      style.left = `${placement.left}px`;
      style.width = `${placement.width}px`;
    }

    if (dirTB === -1) {
      placement.top! -= deltaY;
      placement.height = event.height;
      style.top = `${placement.top}px`;
      style.height = `${placement.height}px`;
    } else if (dirTB === 1) {
      placement.height = event.height;
      style.height = `${placement.height}px`;
    }
  };

  handleMouseEnter = (event: React.MouseEvent, isSelected: boolean | undefined) => {
    const scene = this.getScene();

    const shouldHandleTooltip =
      !scene?.isEditingEnabled && !scene?.tooltip?.isOpen && this.options.oneClickMode === OneClickMode.Off;
    if (shouldHandleTooltip) {
      this.handleTooltip(event);
    } else if (!isSelected) {
      scene?.connections.handleMouseEnter(event);
    }

    const shouldHandleOneClickLink =
      this.options.oneClickMode === OneClickMode.Link && this.options.links && this.options.links.length > 0;

    const shouldHandleOneClickAction =
      this.options.oneClickMode === OneClickMode.Action && this.options.actions && this.options.actions.length > 0;

    if (shouldHandleOneClickLink && this.div) {
      const primaryDataLink = this.getPrimaryDataLink();
      if (primaryDataLink) {
        this.div.style.cursor = 'pointer';
        this.div.title = `Navigate to ${primaryDataLink.title === '' ? 'data link' : primaryDataLink.title}`;
      }
    } else if (shouldHandleOneClickAction && this.div) {
      const primaryAction = this.getPrimaryAction();
      if (primaryAction) {
        this.div.style.cursor = 'pointer';
        this.div.title = primaryAction.title;
      }
    }
  };

  getPrimaryDataLink = () => {
    if (this.getLinks) {
      const links = this.getLinks({ valueRowIndex: getRowIndex(this.data.field, this.getScene()!) });
      return links[0];
    }

    return undefined;
  };

  getPrimaryAction = () => {
    const config: ValueLinkConfig = { valueRowIndex: getRowIndex(this.data.field, this.getScene()!) };
    const actionsDefaultFieldConfig = { links: this.options.links ?? [], actions: this.options.actions ?? [] };
    const frames = this.getScene()?.data?.series;

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
        this.getScene()?.panel.props.replaceVariables!,
        actionsDefaultFieldConfig.actions,
        config
      );
      return actions[0];
    }

    return undefined;
  };

  handleTooltip = (event: React.MouseEvent) => {
    const scene = this.getScene();
    if (scene?.tooltipCallback) {
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
    if (scene?.tooltipCallback && !scene?.tooltip?.isOpen && this.options.oneClickMode === OneClickMode.Off) {
      scene.tooltipCallback(undefined);
    }

    if (this.options.oneClickMode !== OneClickMode.Off && this.div) {
      this.div.style.cursor = 'auto';
      this.div.title = '';
    }
  };

  onElementClick = (event: React.MouseEvent) => {
    // If one-click access is enabled, open the primary link
    if (this.options.oneClickMode === OneClickMode.Link) {
      let primaryDataLink = this.getPrimaryDataLink();
      if (primaryDataLink) {
        window.open(primaryDataLink.href, primaryDataLink.target);
      }
    } else if (this.options.oneClickMode === OneClickMode.Action) {
      let primaryAction = this.getPrimaryAction();
      if (primaryAction && primaryAction.onClick) {
        primaryAction.onClick(event);
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
    if (scene?.tooltipCallback && scene.tooltip?.anchorPoint) {
      scene.tooltipCallback({
        anchorPoint: { x: scene.tooltip.anchorPoint.x, y: scene.tooltip.anchorPoint.y },
        element: this,
        isOpen: true,
      });
    }
  };

  render() {
    const { item, div } = this;
    const scene = this.getScene();
    const isSelected = div && scene && scene.selecto && scene.selecto.getSelectedTargets().includes(div);

    return (
      <div
        key={this.UID}
        ref={this.initElement}
        onMouseEnter={(e: React.MouseEvent) => this.handleMouseEnter(e, isSelected)}
        onMouseLeave={!scene?.isEditingEnabled ? this.handleMouseLeave : undefined}
        onClick={!scene?.isEditingEnabled ? this.onElementClick : undefined}
        onKeyDown={!scene?.isEditingEnabled ? this.onElementKeyDown : undefined}
        role="button"
        tabIndex={0}
      >
        <item.display
          key={`${this.UID}/${this.revId}`}
          config={this.options.config}
          data={this.data}
          isSelected={isSelected}
        />
      </div>
    );
  }
}
