import React, { CSSProperties } from 'react';

import {
  BackgroundImageSize,
  CanvasElementItem,
  CanvasElementOptions,
  canvasElementRegistry,
} from 'app/features/canvas';
import { DimensionContext } from 'app/features/dimensions';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { GroupState } from './group';

import Moveable from 'moveable';

let counter = 100;

export class ElementState {
  readonly UID = counter++;

  revId = 0;
  sizeStyle: CSSProperties = {};
  dataStyle: CSSProperties = {};

  // Calculated
  width = 100;
  height = 100;
  data?: any; // depends on the type

  constructor(public item: CanvasElementItem, public options: CanvasElementOptions, public parent?: GroupState) {
    if (!options) {
      this.options = { type: item.id };
    }
  }

  // The parent size, need to set our own size based on offsets
  updateSize(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Update the CSS position
    this.sizeStyle = {
      // width,
      // height,
      ...this.options.placement,
      position: 'relative', // leaf nodes are relative
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

  // Something changed
  onChange(options: CanvasElementOptions) {
    if (this.item.id !== options.type) {
      this.item = canvasElementRegistry.getIfExists(options.type) ?? notFoundItem;
    }

    this.revId++;
    this.options = { ...options };
    let trav = this.parent;
    while (trav) {
      trav.revId++;
      trav = trav.parent;
    }
  }

  getSaveModel() {
    return { ...this.options };
  }

  // updateElementPosition(top: number, left: number) {
  //   console.log('BEFORE', this.options.placement);

  //   this.options.placement = {
  //     ...this.options.placement,
  //     top: top,
  //     left: left,
  //   };

  //   console.log('AFTER', this.options.placement);
  // }

  // use transform to modify relative top / left values
  // whether than worrying right now about serializing it

  // resize / selecto
  // Do we want to serialize at the end of each event (how often events are fired)
  // Implement resize / selecto first before determining approach for serialization

  // IF define object with relative positioning (bottom / right) -> does transform still work -> double check

  setUpMoveable(target: HTMLDivElement) {
    const moveable = new Moveable(document.getElementById('canvas-panel')!, {
      target: target,
      draggable: true,
      throttleDrag: 0,
      throttleDragRotate: 0,
      resizable: true,
      throttleResize: 0,
    });

    const frame = {
      translate: [0, 0],
    };

    // const updateElementPosition = (top: number, left: number) => {
    //   console.log('BEFORE', top, left);

    //   this.options.placement = {
    //     ...this.options.placement,
    //     top: top,
    //     left: left,
    //   };

    //   console.log('AFTER', this.options.placement);
    // };

    moveable
      .on('dragStart', ({ set }) => {
        set(frame.translate);
      })
      .on('drag', ({ target, beforeTranslate }) => {
        frame.translate = beforeTranslate;
        target.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`;
      })
      .on('dragEnd', ({ target, isDrag, clientX, clientY }) => {
        console.log('onDragEnd', target, isDrag);
        console.log(target.style.top);
        // updateElementPosition(Number(target.style.top), Number(target.style.left));
      });

    moveable
      .on('resizeStart', ({ target, clientX, clientY }) => {
        console.log('onResizeStart', target);
      })
      .on('resize', ({ target, width, height, dist, delta, clientX, clientY }) => {
        console.log('onResize', target);
        delta[0] && (target!.style.width = `${width}px`);
        delta[1] && (target!.style.height = `${height}px`);
      })
      .on('resizeEnd', ({ target, isDrag, clientX, clientY }) => {
        console.log('onResizeEnd', target, isDrag);
      });
  }

  render() {
    const { item } = this;
    return (
      <div key={`${this.UID}/${this.revId}`} style={{ ...this.sizeStyle, ...this.dataStyle }} ref={this.setUpMoveable}>
        <item.display config={this.options.config} width={this.width} height={this.height} data={this.data} />
      </div>
    );
  }
}
