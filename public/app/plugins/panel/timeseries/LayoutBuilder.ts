import React from 'react';

export interface LayoutRendererComponentProps<T extends string> {
  slots: Partial<Record<T, React.ReactNode | null>>;
  refs: Record<T, (i: any) => void>;
  width: number;
  height: number;
}

export type LayoutRendererComponent<T extends string> = React.ComponentType<LayoutRendererComponentProps<T>>;

// Fluent API for defining and rendering layout
export class LayoutBuilder<T extends string> {
  private layout: Partial<Record<T, React.ReactNode | null>> = {};

  constructor(
    private renderer: LayoutRendererComponent<T>,
    private refsMap: Record<T, (i: any) => void>,
    private width: number,
    private height: number
  ) {}

  getLayout() {
    return this.layout;
  }
  addSlot(id: T, node: React.ReactNode) {
    this.layout[id] = node;
    return this;
  }

  clearSlot(id: T) {
    if (this.layout[id] && this.refsMap[id]) {
      delete this.layout[id];

      this.refsMap[id](null);
    }
    return this;
  }

  render() {
    if (!this.layout) {
      return null;
    }

    return React.createElement(this.renderer, {
      slots: this.layout,
      refs: this.refsMap,
      width: this.width,
      height: this.height,
    });
  }
}
