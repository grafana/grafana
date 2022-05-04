import React from 'react';

import { CanvasGroupOptions, CanvasElementOptions } from 'app/features/canvas';

import { GroupState } from './group';
import { Scene } from './scene';

export class RootElement extends GroupState {
  constructor(public options: CanvasGroupOptions, public scene: Scene, private changeCallback: () => void) {
    super(options, scene);

    this.sizeStyle = {
      height: '100%',
      width: '100%',
    };
  }

  isRoot(): this is RootElement {
    return true;
  }

  // root type can not change
  onChange(options: CanvasElementOptions) {
    this.revId++;
    this.options = { ...options } as CanvasGroupOptions;
    this.changeCallback();
  }

  getSaveModel(): CanvasGroupOptions {
    const { placement, constraint, ...rest } = this.options;

    return {
      ...rest, // everything except placement & constraint
      elements: this.elements.map((v) => v.getSaveModel()),
    };
  }

  setRootRef = (target: HTMLDivElement) => {
    this.div = target;
  };

  render() {
    return (
      <div key={this.UID} ref={this.setRootRef} style={{ ...this.sizeStyle, ...this.dataStyle }}>
        {this.elements.map((v) => v.render())}
      </div>
    );
  }
}
