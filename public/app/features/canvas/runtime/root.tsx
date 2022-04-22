import { CanvasGroupOptions, CanvasElementOptions } from 'app/features/canvas';

import { GroupState } from './group';
import { Scene } from './scene';

export class RootElement extends GroupState {
  constructor(public options: CanvasGroupOptions, public scene: Scene, private changeCallback: () => void) {
    super(options, scene);
  }

  isRoot(): this is RootElement {
    return true;
  }

  // The parent size is always fullsize
  updateSize(width: number, height: number) {
    super.updateSize(width, height);
    this.width = width;
    this.height = height;
    this.sizeStyle.width = width;
    this.sizeStyle.height = height;
  }

  // root type can not change
  onChange(options: CanvasElementOptions) {
    this.revId++;
    this.options = { ...options } as CanvasGroupOptions;
    this.changeCallback();
  }

  getSaveModel(): CanvasGroupOptions {
    const { placement, anchor, ...rest } = this.options;

    return {
      ...rest, // everything except placement & anchor
      elements: this.elements.map((v) => v.getSaveModel()),
    };
  }
}
