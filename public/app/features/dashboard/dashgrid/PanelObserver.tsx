import { PanelModel } from '../panel_model';

import _ from 'lodash';

export const PANEL_VISIBILITY_CHANGED_EVENT = 'panel-visibility-changed';

export interface PanelObserver {
  dispose: () => void;
  watch: (e: HTMLElement, panel: PanelModel) => void;
  check: () => void;
}

export class PanelObserverScroll implements PanelObserver {
  private registry = new Map<PanelModel, HTMLElement>();
  private lastChecked = -1;
  private scroller: HTMLElement;
  private listener: EventListenerOrEventListenerObject = null;
  private checkPending = false;

  static readonly MARGIN: number = 200; // Say something it visible if it is close to the window

  //---------------------------------------------------------
  // API
  //---------------------------------------------------------

  dispose() {
    this.registry.clear();
    this.updateScrollListenerCallback(true);
  }

  // this may be called a couple times as
  watch(e: HTMLElement, panel: PanelModel) {
    if (e && panel) {
      let x = this.findScrollWindow(e);
      if (this.scroller) {
        if (x !== this.scroller) {
          console.error('???? did the root scroll element change????');
        }
      }
      this.scroller = x;
      this.registry.set(panel, e);
      this.updateScrollListenerCallback();

      this.checkPending = true;
      setTimeout(() => {
        if (this.checkPending) {
          this.checkPending = true;

          // Remove any stale elements from the DOM
          this.registry.forEach((elem, panel) => {
            if (!document.body.contains(elem)) {
              this.registry.delete(panel);
            }
          });
          this.updateVisibility(true);
        }
      }, 10);
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

  // The grid layout sets the positions explicitly using transform: translage(x, y);
  private getTop(element: HTMLElement): number {
    if (element['data-top'] && element['data-last-transform'] === element.style.transform) {
      return element['data-top'];
    }
    const xform = element.style.transform; // translate(0px, 200px)
    const top = parseInt(xform.substring(xform.lastIndexOf(' ') + 1, xform.lastIndexOf('p')));
    return (element['data-top'] = top);
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
      const top = Math.floor(this.scroller.scrollTop / 10) * 10; // check every 10 pixels
      if (top !== this.lastChecked || force === true) {
        this.lastChecked = top;
        this.updateVisibilityProps(
          this.scroller.scrollTop - PanelObserverScroll.MARGIN,
          this.scroller.scrollTop + PanelObserverScroll.MARGIN + this.scroller.offsetHeight
        );
      }
    }
  }

  // Check visibility for all elements
  updateVisibilityProps(view_top: number, view_bottom: number) {
    //console.log( 'CHECK In Viewport', view_top, view_bottom );
    this.registry.forEach((element, panel) => {
      const top = this.getTop(element);
      const bottom = top + element.offsetHeight;
      const vis = !(view_top > bottom || view_bottom < top);
      //console.log( 'VIS', vis, panel.title, top, bottom );
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
      rootMargin: '200px', // buffer by 100
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
