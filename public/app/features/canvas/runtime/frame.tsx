import { cloneDeep } from 'lodash';
import React from 'react';

import { canvasElementRegistry, CanvasFrameOptions } from 'app/features/canvas';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { DimensionContext } from 'app/features/dimensions';
import { LayerActionID } from 'app/plugins/panel/canvas/types';

import { CanvasElementItem } from '../element';
import { HorizontalConstraint, Placement, VerticalConstraint } from '../types';

import { ElementState } from './element';
import { RootElement } from './root';
import { Scene } from './scene';

export const frameItemDummy: CanvasElementItem = {
  id: 'frame',
  name: 'Frame',
  description: 'Frame',

  getNewOptions: () => ({
    config: {},
  }),

  // eslint-disable-next-line react/display-name
  display: () => {
    return <div>FRAME!</div>;
  },
};

export class FrameState extends ElementState {
  elements: ElementState[] = [];
  scene: Scene;

  constructor(public options: CanvasFrameOptions, scene: Scene, public parent?: FrameState) {
    super(frameItemDummy, options, parent);

    this.scene = scene;

    // mutate options object
    let { elements } = this.options;
    if (!elements) {
      this.options.elements = elements = [];
    }

    for (const c of elements) {
      if (c.type === 'frame') {
        this.elements.push(new FrameState(c as CanvasFrameOptions, scene, this));
      } else {
        const item = canvasElementRegistry.getIfExists(c.type) ?? notFoundItem;
        this.elements.push(new ElementState(item, c, this));
      }
    }
  }

  isRoot(): this is RootElement {
    return false;
  }

  updateData(ctx: DimensionContext) {
    super.updateData(ctx);
    for (const elem of this.elements) {
      elem.updateData(ctx);
    }
  }

  // used in the layer editor
  reorder(startIndex: number, endIndex: number) {
    const result = Array.from(this.elements);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    this.elements = result;

    this.reinitializeMoveable();
  }

  // used for tree view
  reorderTree(src: ElementState, dest: ElementState, firstPosition = false) {
    const result = Array.from(this.elements);
    const srcIndex = this.elements.indexOf(src);
    const destIndex = firstPosition ? this.elements.length - 1 : this.elements.indexOf(dest);

    const [removed] = result.splice(srcIndex, 1);
    result.splice(destIndex, 0, removed);
    this.elements = result;

    this.reinitializeMoveable();
  }

  doMove(child: ElementState, action: LayerActionID) {
    const vals = this.elements.filter((v) => v !== child);
    if (action === LayerActionID.MoveBottom) {
      vals.unshift(child);
    } else {
      vals.push(child);
    }
    this.elements = vals;
    this.scene.save();
    this.reinitializeMoveable();
  }

  reinitializeMoveable() {
    // Need to first clear current selection and then re-init moveable with slight delay
    this.scene.clearCurrentSelection();
    setTimeout(() => this.scene.initMoveable(true, this.scene.isEditingEnabled));
  }

  // ??? or should this be on the element directly?
  // are actions scoped to layers?
  doAction = (action: LayerActionID, element: ElementState, updateName = true, shiftItemsOnDuplicate = true) => {
    switch (action) {
      case LayerActionID.Delete:
        this.elements = this.elements.filter((e) => e !== element);
        this.scene.byName.delete(element.options.name);
        this.scene.save();
        this.reinitializeMoveable();
        break;
      case LayerActionID.Duplicate:
        if (element.item.id === 'frame') {
          console.log('Can not duplicate frames (yet)', action, element);
          return;
        }
        const opts = cloneDeep(element.options);

        if (shiftItemsOnDuplicate) {
          const { constraint, placement: oldPlacement } = element.options;
          const { vertical, horizontal } = constraint ?? {};
          const placement = { ...oldPlacement } ?? ({} as Placement);

          switch (vertical) {
            case VerticalConstraint.Top:
            case VerticalConstraint.TopBottom:
              if (placement.top == null) {
                placement.top = 25;
              } else {
                placement.top += 10;
              }
              break;
            case VerticalConstraint.Bottom:
              if (placement.bottom == null) {
                placement.bottom = 100;
              } else {
                placement.bottom -= 10;
              }
              break;
          }

          switch (horizontal) {
            case HorizontalConstraint.Left:
            case HorizontalConstraint.LeftRight:
              if (placement.left == null) {
                placement.left = 50;
              } else {
                placement.left += 10;
              }
              break;
            case HorizontalConstraint.Right:
              if (placement.right == null) {
                placement.right = 50;
              } else {
                placement.right -= 10;
              }
              break;
          }

          opts.placement = placement;
        }

        const copy = new ElementState(element.item, opts, this);
        copy.updateData(this.scene.context);
        if (updateName) {
          copy.options.name = this.scene.getNextElementName();
        }
        this.elements.push(copy);
        this.scene.byName.set(copy.options.name, copy);
        this.scene.save();
        this.reinitializeMoveable();
        break;
      case LayerActionID.MoveTop:
      case LayerActionID.MoveBottom:
        element.parent?.doMove(element, action);
        break;

      default:
        console.log('DO action', action, element);
        return;
    }
  };

  render() {
    return (
      <div key={this.UID} ref={this.initElement}>
        {this.elements.map((v) => v.render())}
      </div>
    );
  }

  /** Recursively visit all nodes */
  visit(visitor: (v: ElementState) => void) {
    super.visit(visitor);
    for (const e of this.elements) {
      visitor(e);
    }
  }

  getSaveModel() {
    return {
      ...this.options,
      elements: this.elements.map((v) => v.getSaveModel()),
    };
  }
}
