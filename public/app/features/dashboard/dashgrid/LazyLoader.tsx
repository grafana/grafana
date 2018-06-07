import { PanelModel } from '../panel_model';

import _ from 'lodash';

export class LazyLoader {
  private registry = new Map<PanelModel, any>();
  private lastChecked = -1;
  private scroller: any;
  private listener: any = null;
  private onChangeCallback: any;

  register(panel: PanelModel, element: any) {
    if (element && panel.lazyloading) {
      this.registry.set(panel, element);
      this.updateScrollListener();
    }
  }

  setScroller(element: any, onChangeCallback: any) {
    this.onChangeCallback = onChangeCallback;
    this.scroller = element;
    this.updateScrollListener();
  }

  updateScrollListener(remove = false) {
    if (this.scroller) {
      const empty = _.isEmpty(this.registry);
      if (empty || remove) {
        if (this.listener) {
          console.log('Removing lazy loading scroll listener');
          this.scroller.removeEventListener('scroll', this.listener);
          this.listener = null;
        }
      } else if (!this.listener) {
        console.log('Adding lazy loading scroll listener');
        this.listener = this.checkVisibility.bind(this);
        this.scroller.addEventListener('scroll', this.listener, {
          capture: true,
          passive: true,
        });
      }
    }
  }

  checkVisibility(force = false): boolean {
    if (_.isEmpty(this.registry)) {
      this.updateScrollListener(true);
    } else if (this.scroller) {
      const bottom = this.scroller.offsetHeight + this.scroller.scrollTop;
      const check = Math.ceil(bottom / 10) * 10 + 200;
      if (check !== this.lastChecked || force) {
        this.lastChecked = check;
        if (this.loadPanelsAbove(check)) {
          if (this.onChangeCallback) {
            this.onChangeCallback();
          }
          return true;
        }
      }
    }
    return false;
  }

  // Make sure everything below this height is
  loadPanelsAbove(bottom: number): boolean {
    let changed = false;
    this.registry.forEach((value, key, map) => {
      if (!key.lazyloading) {
        changed = true;
        map.delete(key);
      } else {
        const rect = value.getBoundingClientRect();
        if (bottom > rect.top) {
          key.lazyloading = false; // tell the to stop lazy loading
          map.delete(key);
          changed = true;
          console.log('Load Panel:', key.title, '... (' + map.size + ' more delayed panels) bottom: ', bottom);
        }
      }
    });
    return changed;
  }
}
