import React from 'react';
import { CanvasGroupOptions, canvasElementRegistry } from 'app/features/canvas';
import { DimensionContext } from 'app/features/dimensions';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { ElementState } from './element';
import { CanvasElementItem } from '../element';
import { LayerActionID } from 'app/plugins/panel/canvas/types';
import { cloneDeep } from 'lodash';
import { Scene } from './scene';
import { RootElement } from './root';

export const groupItemDummy: CanvasElementItem = {
  id: 'group',
  name: 'Group',
  description: 'Group',

  getNewOptions: () => ({
    config: {},
  }),

  // eslint-disable-next-line react/display-name
  display: () => {
    return <div>GROUP!</div>;
  },
};

export class GroupState extends ElementState {
  elements: ElementState[] = [];
  scene: Scene;

  constructor(public options: CanvasGroupOptions, scene: Scene, public parent?: GroupState) {
    super(groupItemDummy, options, parent);

    this.scene = scene;

    // mutate options object
    let { elements } = this.options;
    if (!elements) {
      this.options.elements = elements = [];
    }

    for (const c of elements) {
      if (c.type === 'group') {
        this.elements.push(new GroupState(c as CanvasGroupOptions, scene, this));
      } else {
        const item = canvasElementRegistry.getIfExists(c.type) ?? notFoundItem;
        this.elements.push(new ElementState(item, c, this));
      }
    }
  }

  isRoot(): this is RootElement {
    return false;
  }

  // The parent size, need to set our own size based on offsets
  updateSize(width: number, height: number) {
    super.updateSize(width, height);
    if (!this.parent) {
      this.width = width;
      this.height = height;
      this.sizeStyle.width = width;
      this.sizeStyle.height = height;
    }

    // Update children with calculated size
    for (const elem of this.elements) {
      elem.updateSize(this.width, this.height);
    }

    // The group forced to full width (for now)
    this.sizeStyle.width = width;
    this.sizeStyle.height = height;
    this.sizeStyle.position = 'absolute';
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

  reinitializeMoveable() {
    // Need to first clear current selection and then re-init moveable with slight delay
    this.scene.clearCurrentSelection();
    setTimeout(() => this.scene.initMoveable(true), 100);
  }

  // ??? or should this be on the element directly?
  // are actions scoped to layers?
  doAction = (action: LayerActionID, element: ElementState, updateName = true) => {
    switch (action) {
      case LayerActionID.Delete:
        this.elements = this.elements.filter((e) => e !== element);
        this.scene.byName.delete(element.options.name);
        this.scene.save();
        this.reinitializeMoveable();
        break;
      case LayerActionID.Duplicate:
        if (element.item.id === 'group') {
          console.log('Can not duplicate groups (yet)', action, element);
          return;
        }
        const opts = cloneDeep(element.options);
        if (element.anchor.top) {
          opts.placement!.top! += 10;
        }
        if (element.anchor.left) {
          opts.placement!.left! += 10;
        }
        if (element.anchor.bottom) {
          opts.placement!.bottom! += 10;
        }
        if (element.anchor.right) {
          opts.placement!.right! += 10;
        }

        const copy = new ElementState(element.item, opts, this);
        copy.updateSize(element.width, element.height);
        copy.updateData(this.scene.context);
        if (updateName) {
          copy.options.name = this.scene.getNextElementName();
        }
        this.elements.push(copy);
        this.scene.byName.set(copy.options.name, copy);
        this.scene.save();
        this.reinitializeMoveable();
        break;
      default:
        console.log('DO action', action, element);
        return;
    }
  };

  render() {
    return (
      <div key={`${this.UID}/${this.revId}`} style={{ ...this.sizeStyle, ...this.dataStyle }}>
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
