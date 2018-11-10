import { PanelModel } from '../panel_model';

import 'intersection-observer';

export const PANEL_VISIBILITY_CHANGED_EVENT = 'panel-visibility-changed';

export interface PanelObserver {
  dispose: () => void;
  watch: (e: HTMLElement, panel: PanelModel) => void;
}

export class PanelObserverIntersection implements PanelObserver {
  observer: IntersectionObserver;

  constructor() {
    this.observer = new IntersectionObserver(this.callback.bind(this), {
      root: null, // the viewport
      rootMargin: '200px', // buffer by 200
      threshold: 0, // any pixel
    });
  }

  //---------------------------------------------------------
  // API
  //---------------------------------------------------------

  dispose() {
    this.observer.disconnect();
  }

  watch(e: HTMLElement, panel: PanelModel) {
    if (e && panel) {
      e['data-garfana-panel'] = panel;
      this.observer.observe(e);
    }
  }

  //---------------------------------------------------------
  // Internal
  //---------------------------------------------------------

  private callback(entries: IntersectionObserverEntry[]) {
    // Fast scrolling can send multiple callbacks quickly
    // !intersecting => intersecting => !intersecting in one callback.
    const visible = new Map<PanelModel, boolean>();
    entries.forEach(entry => {
      const panel = entry.target['data-garfana-panel'];
      if (panel.visible !== entry.isIntersecting) {
        visible.set(panel, entry.isIntersecting);
      }
    });

    // Only emit events for values that have changed
    visible.forEach((vis, panel) => {
      if (panel.visible !== vis) {
        panel.visible = vis;
        panel.events.emit(PANEL_VISIBILITY_CHANGED_EVENT, panel.visible);
      }
    });
  }
}
