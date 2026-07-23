import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { type GrafanaTheme2, ThemeContext } from '@grafana/data';

import { type MonacoEditor } from '../types';

import { CoauthorPopover } from './CoauthorPopover';
import { PopoverOverlay } from './PopoverOverlay';
import { type EditorActions, type Journey } from './types';

/**
 * Renders the assistant popover anchored at the text caret. The popover is
 * portalled into Grafana's overlay container (see PopoverOverlay), so it paints
 * above panels and the Monaco suggest widget and is never clipped by the
 * editor's `overflow: hidden`. Screen coordinates are derived from the caret
 * via `getScrolledVisiblePosition`; the controller calls `reposition()` on
 * caret/scroll/resize to keep it glued to the caret.
 */
export class CaretPopover {
  private container = document.createElement('div');
  private root: Root;
  private open = false;
  private current?: { journey: Journey; actions: EditorActions; onClose: () => void };

  constructor(
    private editor: MonacoEditor,
    private theme: GrafanaTheme2
  ) {
    this.root = createRoot(this.container);
  }

  private computeAnchor(): { top: number; left: number } {
    const pos = this.editor.getPosition();
    const domNode = this.editor.getDomNode();
    const rect = domNode?.getBoundingClientRect();
    if (!pos || !rect) {
      return { top: 120, left: 120 };
    }
    const visible = this.editor.getScrolledVisiblePosition(pos);
    if (!visible) {
      return { top: rect.bottom + 8, left: rect.left };
    }
    return {
      top: rect.top + visible.top + visible.height + 6,
      left: rect.left + visible.left,
    };
  }

  private render() {
    if (!this.open || !this.current) {
      this.root.render(null);
      return;
    }
    const { journey, actions, onClose } = this.current;
    this.root.render(
      createElement(
        ThemeContext.Provider,
        { value: this.theme },
        createElement(
          PopoverOverlay,
          { anchor: this.computeAnchor() },
          createElement(CoauthorPopover, { journey, actions, onClose })
        )
      )
    );
  }

  show(journey: Journey, actions: EditorActions, onClose: () => void) {
    this.open = true;
    this.current = { journey, actions, onClose };
    this.render();
  }

  reposition() {
    if (this.open) {
      this.render();
    }
  }

  isOpen() {
    return this.open;
  }

  hide() {
    if (this.open) {
      this.open = false;
      this.current = undefined;
      this.root.render(null);
    }
  }

  dispose() {
    this.hide();
    setTimeout(() => this.root.unmount(), 0);
  }
}
