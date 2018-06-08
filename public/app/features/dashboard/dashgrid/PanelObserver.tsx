import { PanelModel } from '../panel_model';

import _ from 'lodash';

export const PANEL_VISIBILITY_CHANGED_EVENT = 'panel-visibility-changed';

export interface PanelObserver {
  dispose: () => void;
  watch: (e: any, panel: PanelModel) => void;
  check: () => void;
}

export class PanelObserverScroll implements PanelObserver {
  private registry = new Map<PanelModel, any>();
  private lastChecked = -1;
  private scroller: any;
  private listener: any = null;

  static readonly MARGIN: number = 0; // Say something it visible if it is close to the window

  constructor() {}

  //---------------------------------------------------------
  // API
  //---------------------------------------------------------

  dispose() {
    this.registry.clear();
    this.updateScrollListenerCallback(true);
  }

  watch(e: HTMLElement, panel: PanelModel) {
    if (e && panel) {
      let x = this.findScrollWindow(e);
      if (this.scroller) {
        if (x !== this.scroller) {
          console.error('???? did the root scroll element change????');
          // debugger;
        }
      }
      this.scroller = x;
      this.registry.set(panel, e);
      this.updateScrollListenerCallback();
    }
  }

  // Called externally on big change
  check() {
    this.updateVisibility(true); // force check
  }

  //---------------------------------------------------------
  // Internal
  //---------------------------------------------------------

  // HACK?  Is there a standard non-jquery way to do this?
  private findScrollWindow(element: HTMLElement): HTMLElement {
    let t: HTMLElement = element.parentElement;
    while (t != null) {
      if ('scroll-canvas scroll-canvas--dashboard' === t.className) {
        return t;
      }
      t = t.parentElement;
    }
    return null;
  }

  //---------------------------------------------------------
  // Scroll Handling
  //---------------------------------------------------------

  private updateScrollListenerCallback(remove = false) {
    if (this.scroller) {
      const empty = _.isEmpty(this.registry);
      if (empty || remove) {
        if (this.listener) {
          console.log('Removing dashboard scroll listener');
          this.scroller.removeEventListener('scroll', this.listener);
          this.listener = null;
        }
      } else if (!this.listener) {
        console.log('Adding dashboard scroll listener');
        this.listener = this.updateVisibility.bind(this);
        this.scroller.addEventListener('scroll', this.listener, {
          capture: true,
          passive: true,
        });
      }
    }
  }

  // The Scroll callback
  updateVisibility(force = false) {
    if (_.isEmpty(this.registry)) {
      this.updateScrollListenerCallback(true);
    } else if (this.scroller) {
      const bottom = this.scroller.offsetHeight + this.scroller.scrollTop;
      const round = Math.ceil(bottom / 10) * 10;
      if (round !== this.lastChecked || force) {
        this.lastChecked = round;
        this.updateVisibilityProps(
          this.scroller.scrollTop - PanelObserverScroll.MARGIN,
          bottom + PanelObserverScroll.MARGIN
        );
      }
    }
  }

  // Check visibility for all elements
  updateVisibilityProps(view_top: number, view_bottom: number) {
    this.registry.forEach((element, panel) => {
      //const rect = element.getBoundingClientRect();
      const xform = element.style.transform; // translate(0px, 200px)
      const top = parseInt(xform.substring(xform.lastIndexOf(' ') + 1, xform.lastIndexOf('p')));
      const bottom = top + element.offsetHeight;
      const vis = !(view_top > bottom || view_bottom < top);

      // debugger;

      if (panel.visible !== vis) {
        panel.visible = vis;
        panel.events.emit(PANEL_VISIBILITY_CHANGED_EVENT, vis);
      }
    });
  }
}

export class PanelObserverIntersection implements PanelObserver {
  observer: IntersectionObserver;

  constructor() {
    this.observer = new IntersectionObserver(this.callback.bind(this), {
      root: null, // the viewport
      rootMargin: '100px', // buffer by 100
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

  // Called externally on big change
  check() {
    // nothing?
  }

  //---------------------------------------------------------
  // Internal
  //---------------------------------------------------------

  private callback(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      const panel = entry.target['data-garfana-panel'];
      if (panel.visible !== entry.isIntersecting) {
        panel.visible = entry.isIntersecting;
        panel.events.emit(PANEL_VISIBILITY_CHANGED_EVENT, entry.isIntersecting);
      }
    });
  }
}
