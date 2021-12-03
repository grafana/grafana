import React, { CSSProperties } from 'react';
import { OnDrag, OnResize } from 'react-moveable/declaration/types';

import {
  BackgroundImageSize,
  CanvasElementItem,
  CanvasElementOptions,
  canvasElementRegistry,
  Placement,
  Anchor,
} from 'app/features/canvas';
import { DimensionContext } from 'app/features/dimensions';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { GroupState } from './group';
import { LayerElement } from 'app/core/components/Layers/types';
import { Scene } from './scene';

let counter = 0;

export class ElementState implements LayerElement {
  // UID necessary for moveable to work (for now)
  readonly UID = counter++;
  revId = 0;
  sizeStyle: CSSProperties = {};
  dataStyle: CSSProperties = {};

  // Filled in by ref
  div?: HTMLDivElement;

  // Calculated
  width = 100;
  height = 100;
  data?: any; // depends on the type

  // From options, but always set and always valid
  anchor: Anchor;
  placement: Placement;

  constructor(public item: CanvasElementItem, public options: CanvasElementOptions, public parent?: GroupState) {
    const fallbackName = `Element ${Date.now()}`;
    if (!options) {
      this.options = { type: item.id, name: fallbackName };
    }
    this.anchor = options.anchor ?? {};
    this.placement = options.placement ?? {};
    options.anchor = this.anchor;
    options.placement = this.placement;

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

  validatePlacement() {
    const { anchor, placement } = this;
    if (!(anchor.left || anchor.right)) {
      anchor.left = true;
    }
    if (!(anchor.top || anchor.bottom)) {
      anchor.top = true;
    }

    const w = placement.width ?? 100; // this.div ? this.div.clientWidth : this.width;
    const h = placement.height ?? 100; // this.div ? this.div.clientHeight : this.height;

    if (anchor.top) {
      if (!placement.top) {
        placement.top = 0;
      }
      if (anchor.bottom) {
        delete placement.height;
      } else {
        placement.height = h;
        delete placement.bottom;
      }
    } else if (anchor.bottom) {
      if (!placement.bottom) {
        placement.bottom = 0;
      }
      placement.height = h;
      delete placement.top;
    }

    if (anchor.left) {
      if (!placement.left) {
        placement.left = 0;
      }
      if (anchor.right) {
        delete placement.width;
      } else {
        placement.width = w;
        delete placement.right;
      }
    } else if (anchor.right) {
      if (!placement.right) {
        placement.right = 0;
      }
      placement.width = w;
      delete placement.left;
    }

    this.width = w;
    this.height = h;

    this.options.anchor = this.anchor;
    this.options.placement = this.placement;
  }

  // The parent size, need to set our own size based on offsets
  updateSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.validatePlacement();

    // Update the CSS position
    this.sizeStyle = {
      ...this.options.placement,
      position: 'absolute',
    };
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

    if (oldName !== newName) {
      const scene = this.getScene();
      scene?.byName.delete(oldName);
      scene?.byName.set(newName, this);
    }
  }

  getSaveModel() {
    return { ...this.options };
  }

  initElement = (target: HTMLDivElement) => {
    this.div = target;
  };

  applyDrag = (event: OnDrag) => {
    const { placement, anchor } = this;

    const deltaX = event.delta[0];
    const deltaY = event.delta[1];

    const style = event.target.style;
    if (anchor.top) {
      placement.top! += deltaY;
      style.top = `${placement.top}px`;
    }
    if (anchor.bottom) {
      placement.bottom! -= deltaY;
      style.bottom = `${placement.bottom}px`;
    }
    if (anchor.left) {
      placement.left! += deltaX;
      style.left = `${placement.left}px`;
    }
    if (anchor.right) {
      placement.right! -= deltaX;
      style.right = `${placement.right}px`;
    }
  };

  // kinda like:
  // https://github.com/grafana/grafana-edge-app/blob/main/src/panels/draw/WrapItem.tsx#L44
  applyResize = (event: OnResize) => {
    const { placement, anchor } = this;

    const style = event.target.style;
    const deltaX = event.delta[0];
    const deltaY = event.delta[1];
    const dirLR = event.direction[0];
    const dirTB = event.direction[1];
    if (dirLR === 1) {
      // RIGHT
      if (anchor.right) {
        placement.right! -= deltaX;
        style.right = `${placement.right}px`;
        if (!anchor.left) {
          placement.width = event.width;
          style.width = `${placement.width}px`;
        }
      } else {
        placement.width! = event.width;
        style.width = `${placement.width}px`;
      }
    } else if (dirLR === -1) {
      // LEFT
      if (anchor.left) {
        placement.left! -= deltaX;
        placement.width! = event.width;
        style.left = `${placement.left}px`;
        style.width = `${placement.width}px`;
      } else {
        placement.width! += deltaX;
        style.width = `${placement.width}px`;
      }
    }

    if (dirTB === -1) {
      // TOP
      if (anchor.top) {
        placement.top! -= deltaY;
        placement.height = event.height;
        style.top = `${placement.top}px`;
        style.height = `${placement.height}px`;
      } else {
        placement.height = event.height;
        style.height = `${placement.height}px`;
      }
    } else if (dirTB === 1) {
      // BOTTOM
      if (anchor.bottom) {
        placement.bottom! -= deltaY;
        placement.height! = event.height;
        style.bottom = `${placement.bottom}px`;
        style.height = `${placement.height}px`;
      } else {
        placement.height! = event.height;
        style.height = `${placement.height}px`;
      }
    }

    this.width = event.width;
    this.height = event.height;
  };

  render() {
    const { item } = this;
    return (
      <div key={`${this.UID}`} style={{ ...this.sizeStyle, ...this.dataStyle }} ref={this.initElement}>
        <item.display
          key={`${this.UID}/${this.revId}`}
          config={this.options.config}
          width={this.width}
          height={this.height}
          data={this.data}
        />
      </div>
    );
  }
}
