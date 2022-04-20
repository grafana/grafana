import React, { CSSProperties } from 'react';
import { OnDrag, OnDragStart, OnResize } from 'react-moveable/declaration/types';

import {
  BackgroundImageSize,
  CanvasElementItem,
  CanvasElementOptions,
  canvasElementRegistry,
} from 'app/features/canvas';
import { DimensionContext } from 'app/features/dimensions';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { GroupState } from './group';
import { LayerElement } from 'app/core/components/Layers/types';
import { Scene } from './scene';
import { HorizontalConstraint, Placement, VerticalConstraint } from '../types';

let counter = 0;
const startTime = Date.now();

export class ElementState implements LayerElement {
  // UID necessary for moveable to work (for now)
  readonly UID = counter++;
  revId = 0;
  sizeStyle: CSSProperties = {};
  dataStyle: CSSProperties = {};

  // Filled in by ref
  div?: HTMLDivElement;

  // Calculated
  data?: any; // depends on the type

  constructor(public item: CanvasElementItem, public options: CanvasElementOptions, public parent?: GroupState) {
    const fallbackName = `Element ${Date.now()}`;
    if (!options) {
      this.options = { type: item.id, name: fallbackName };
    }

    options.constraint = options.constraint ?? {
      vertical: VerticalConstraint.Top,
      horizontal: HorizontalConstraint.Left,
    };
    options.placement = options.placement ?? { width: 100, height: 100, top: 0, left: 0 };
    this.updateLayout();
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
        break;
      }
      trav = trav.parent;
    }

    return undefined;
  }

  getName() {
    return this.options.name;
  }

  updateLayout() {
    const { constraint } = this.options;
    const { vertical, horizontal } = constraint ?? {};
    const placement = this.options.placement ?? ({} as Placement);

    const style: React.CSSProperties = {
      position: 'absolute',
      transform: 'translate(0px, 0px)',
      maxWidth: Date.now(),
    };

    switch (vertical) {
      case VerticalConstraint.Top:
        placement.top = placement.top ?? 0;
        placement.height = placement.height ?? 100;
        style.top = placement.top;
        style.height = placement.height;
        delete placement.bottom;
        break;
      case VerticalConstraint.Bottom:
        placement.bottom = placement.bottom ?? 0;
        placement.height = placement.height ?? 100;
        style.bottom = placement.bottom;
        style.height = placement.height;
        delete placement.top;
        break;
      case VerticalConstraint.TopBottom:
        placement.top = placement.top ?? 0;
        placement.bottom = placement.bottom ?? 0;
        style.top = placement.top;
        style.bottom = placement.bottom;
        delete placement.height;
        break;
    }

    switch (horizontal) {
      case HorizontalConstraint.Left:
        placement.left = placement.left ?? 0;
        placement.width = placement.width ?? 100;
        style.left = placement.left;
        style.width = placement.width;
        delete placement.right;
        break;
      case HorizontalConstraint.Right:
        placement.right = placement.right ?? 0;
        placement.width = placement.width ?? 100;
        style.right = placement.right;
        style.width = placement.width;
        delete placement.left;
        break;
      case HorizontalConstraint.LeftRight:
        placement.left = placement.left ?? 0;
        placement.right = placement.right ?? 0;
        style.left = placement.left;
        style.right = placement.right;
        delete placement.width;
        break;
      case HorizontalConstraint.Scale:
        placement.left = placement.left ?? 0;
        placement.right = placement.right ?? 0;
        style.left = `${placement.left}%`;
        style.right = `${placement.right}%`;
        delete placement.width;
        break;
    }

    this.options.placement = placement;
    this.sizeStyle = style;
    console.log('sizeStyle', this.sizeStyle);
    if (this.div) {
      this.div.style.maxWidth = `${Date.now() - startTime}px`;
      this.div.style.minWidth = '1px';
      // style={{ ...this.sizeStyle, ...this.dataStyle }}
      const style = this.div.style;

      for (const key in this.sizeStyle) {
        this.div.style[key as any] = (this.sizeStyle as any)[key];
      }

      for (const key in this.dataStyle) {
        this.div.style[key as any] = (this.dataStyle as any)[key];
      }

      console.log('calling updateLayout;;;', style.cssText);
      this.div.setAttribute('a', 'hello');
    }
  }

  setPlacementFromConstraint() {
    const { constraint } = this.options;
    const { vertical, horizontal } = constraint ?? {};

    const elementContainer = this.div && this.div.getBoundingClientRect();
    console.log(elementContainer, this.div?.style.transform, 'calling setPlacement form constraint');
    const parentContainer = this.div && this.div.parentElement?.getBoundingClientRect();

    const relativeTop =
      elementContainer && parentContainer ? Math.abs(Math.round(elementContainer.top - parentContainer.top)) : 0;
    const relativeBottom =
      elementContainer && parentContainer ? Math.abs(Math.round(elementContainer.bottom - parentContainer.bottom)) : 0;
    const relativeLeft =
      elementContainer && parentContainer ? Math.abs(Math.round(elementContainer.left - parentContainer.left)) : 0;
    const relativeRight =
      elementContainer && parentContainer ? Math.abs(Math.round(elementContainer.right - parentContainer.right)) : 0;

    const placement = {} as Placement;

    const width = elementContainer?.width ?? 100;
    const height = elementContainer?.height ?? 100;

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
      case HorizontalConstraint.Scale:
        placement.left = relativeLeft / (parentContainer?.width ?? width);
        placement.right = relativeRight / (parentContainer?.width ?? width);
        break;
    }

    this.options.placement = placement;

    this.updateLayout();
    this.onChange(this.options);
    console.log('called onChange / update placement', this.options);
  }

  updateData(ctx: DimensionContext) {
    if (this.item.prepareData) {
      this.data = this.item.prepareData(ctx, this.options.config);
      this.revId++; // rerender
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
          }
        }
      }
    }

    if (border && border.color && border.width) {
      const color = ctx.getColor(border.color);
      css.borderWidth = border.width;
      css.borderStyle = 'solid';
      css.borderColor = color.value();

      // Move the image to inside the border
      if (css.backgroundImage) {
        css.backgroundOrigin = 'padding-box';
      }
    }

    this.dataStyle = css;
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
      scene.byName.delete(oldName);
      scene.byName.set(newName, this);
    }
  }

  getSaveModel() {
    return { ...this.options };
  }

  initElement = (target: HTMLDivElement) => {
    this.div = target;
    this.updateLayout();
  };

  tempPosition = {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  };
  applyDirectPosition(event: OnDragStart) {
    // const style = event.target.style;
    const elementContainer = event.target.getBoundingClientRect();
    const parentContainer = event.target.parentElement?.getBoundingClientRect();

    const relativeTop =
      elementContainer && parentContainer ? Math.abs(Math.round(elementContainer.top - parentContainer.top)) : 0;
    const relativeLeft =
      elementContainer && parentContainer ? Math.abs(Math.round(elementContainer.left - parentContainer.left)) : 0;

    this.tempPosition.top = relativeTop;
    this.tempPosition.left = relativeLeft;
    this.tempPosition.width = elementContainer.width;
    this.tempPosition.height = elementContainer.height;

    // console.log(this.tempPosition);

    // style.position = 'absolute';
    // style.top = `${this.tempPosition.top}px`;
    // style.left = `${this.tempPosition.left}px`;
    // style.width = `${this.tempPosition.width}px`;
    // style.height = `${this.tempPosition.height}px`;
    // style.right = '';
    // style.left = '';
  }

  applyDrag = (event: OnDrag) => {
    // const deltaX = event.delta[0];
    // const deltaY = event.delta[1];
    // const style = event.target.style;

    // this.tempPosition.top += deltaY;
    // this.tempPosition.left += deltaX;

    // style.top = `${this.tempPosition.top}px`;
    // style.left = `${this.tempPosition.left}px`;

    event.target.style.transform = event.transform;
  };

  // kinda like:
  // https://github.com/grafana/grafana-edge-app/blob/main/src/panels/draw/WrapItem.tsx#L44
  applyResize = (event: OnResize) => {
    const { options } = this;
    const { placement, constraint } = options;
    const { vertical, horizontal } = constraint ?? {};

    const top = vertical === VerticalConstraint.Top || vertical === VerticalConstraint.TopBottom;
    const bottom = vertical === VerticalConstraint.Bottom || vertical === VerticalConstraint.TopBottom;
    const left = horizontal === HorizontalConstraint.Left || horizontal === HorizontalConstraint.LeftRight;
    const right = horizontal === HorizontalConstraint.Right || horizontal === HorizontalConstraint.LeftRight;

    const style = event.target.style;
    const deltaX = event.delta[0];
    const deltaY = event.delta[1];
    const dirLR = event.direction[0];
    const dirTB = event.direction[1];
    if (dirLR === 1) {
      // RIGHT
      if (right) {
        placement!.right! -= deltaX;
        style.right = `${placement!.right}px`;
        if (!left) {
          placement!.width = event.width;
          style.width = `${placement!.width}px`;
        }
      } else {
        placement!.width! = event.width;
        style.width = `${placement!.width}px`;
      }
    } else if (dirLR === -1) {
      // LEFT
      if (left) {
        placement!.left! -= deltaX;
        placement!.width! = event.width;
        style.left = `${placement!.left}px`;
        style.width = `${placement!.width}px`;
      } else {
        placement!.width! += deltaX;
        style.width = `${placement!.width}px`;
      }
    }

    if (dirTB === -1) {
      // TOP
      if (top) {
        placement!.top! -= deltaY;
        placement!.height = event.height;
        style.top = `${placement!.top}px`;
        style.height = `${placement!.height}px`;
      } else {
        placement!.height = event.height;
        style.height = `${placement!.height}px`;
      }
    } else if (dirTB === 1) {
      // BOTTOM
      if (bottom) {
        placement!.bottom! -= deltaY;
        placement!.height! = event.height;
        style.bottom = `${placement!.bottom}px`;
        style.height = `${placement!.height}px`;
      } else {
        placement!.height! = event.height;
        style.height = `${placement!.height}px`;
      }
    }

    // TODO: Center + Scale
  };

  render() {
    const { item } = this;

    console.log('rendering element', { revId: this.revId, uid: this.UID });

    const key = `${this.UID}/${this.revId}`;
    // <div style={{ ...this.sizeStyle, ...this.dataStyle }} ref={this.initElement}>

    return (
      <div key={this.UID} ref={this.initElement}>
        <item.display key={key} config={this.options.config} data={this.data} />
      </div>
    );
  }
}
