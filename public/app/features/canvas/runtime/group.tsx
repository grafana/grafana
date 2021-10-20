import React from 'react';
import { CanvasGroupOptions, canvasElementRegistry } from 'app/features/canvas';
import { DimensionContext } from 'app/features/dimensions';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { ElementState } from './element';
import { CanvasElementItem } from '../element';
import { LayerActionID } from 'app/plugins/panel/canvas/types';
import { cloneDeep } from 'lodash';

export const groupItemDummy: CanvasElementItem = {
  id: 'group',
  name: 'Group',
  description: 'Group',

  defaultConfig: {},

  // eslint-disable-next-line react/display-name
  display: () => {
    return <div>GROUP!</div>;
  },
};

export class GroupState extends ElementState {
  elements: ElementState[] = [];

  constructor(public options: CanvasGroupOptions, public parent?: GroupState) {
    super(groupItemDummy, options, parent);

    // mutate options object
    let { elements } = this.options;
    if (!elements) {
      this.options.elements = elements = [];
    }

    for (const c of elements) {
      if (c.type === 'group') {
        this.elements.push(new GroupState(c as CanvasGroupOptions, this));
      } else {
        const item = canvasElementRegistry.getIfExists(c.type) ?? notFoundItem;
        this.elements.push(new ElementState(item, c, this));
      }
    }
  }

  isRoot() {
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
    this.onChange(this.getSaveModel());
  }

  // ??? or should this be on the element directly?
  // are actions scoped to layers?
  doAction = (action: LayerActionID, element: ElementState) => {
    switch (action) {
      case LayerActionID.Delete:
        this.elements = this.elements.filter((e) => e !== element);
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
        console.log('DUPLICATE', opts);
        const copy = new ElementState(element.item, opts, this);
        copy.updateSize(element.width, element.height);
        copy.updateData(element.data); // :bomb:  <-- need some way to tell the scene to re-init size and data
        this.elements.push(copy);
        break;
      default:
        console.log('DO action', action, element);
        return;
    }

    this.onChange(this.getSaveModel());
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
