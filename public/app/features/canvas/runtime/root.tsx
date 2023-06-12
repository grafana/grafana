import React from 'react';

import { CanvasElementOptions, CanvasFrameOptions } from 'app/features/canvas';

import { FrameState } from './frame';
import { Scene } from './scene';

export class RootElement extends FrameState {
  constructor(public options: CanvasFrameOptions, public scene: Scene, private changeCallback: () => void) {
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
    this.options = { ...options } as CanvasFrameOptions;
    this.changeCallback();
  }

  getSaveModel(): CanvasFrameOptions {
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
      <div
        onContextMenu={(event) => event.preventDefault()}
        key={this.UID}
        ref={this.setRootRef}
        style={{ ...this.sizeStyle, ...this.dataStyle }}
      >
        {this.elements.map((v) => v.render())}
      </div>
    );
  }
}
