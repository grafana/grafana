import React from 'react';
import { CanvasGroupOptions, canvasElementRegistry } from 'app/features/canvas';
import { DimensionContext } from 'app/features/dimensions';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { ElementState } from './element';
import { CanvasElementItem } from '../element';

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
  readonly elements: ElementState[] = [];

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
        this.elements.push(new ElementState(item, c, parent));
      }
    }
  }

  // The parent size, need to set our own size based on offsets
  updateSize(width: number, height: number) {
    super.updateSize(width, height);

    // Update children with calculated size
    for (const elem of this.elements) {
      elem.updateSize(this.width, this.height);
    }
  }

  updateData(ctx: DimensionContext) {
    super.updateData(ctx);
    for (const elem of this.elements) {
      elem.updateData(ctx);
    }
  }

  render() {
    return (
      <div key={`${this.UID}/${this.revId}`} style={this.style}>
        {this.elements.map((v) => v.render())}
      </div>
    );
  }

  /** Recursivly visit all nodes */
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
