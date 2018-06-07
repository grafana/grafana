import React from 'react';
import { DashboardPanel } from './DashboardPanel';
import { PanelModel } from '../panel_model';

import _ from 'lodash';

export class LazyRegistry {
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
          console.log('Loading', map.size, key.id, key.title);
        }
      }
    });
    return changed;
  }
}

export interface LazyLoaderProps {
  wrapper: DashboardPanel;
}

export class LazyLoader extends React.Component<LazyLoaderProps, any> {
  constructor(props) {
    super(props);
  }

  // This should not be necessary, but we will add it just in case
  onClick() {
    this.props.wrapper.setState({ load: true });
  }

  render() {
    const { panel } = this.props.wrapper.props;
    return (
      <div onClick={this.onClick.bind(this)} className="pointer">
        <i className="fa fa-spinner fa-spin" /> {panel.title}...
      </div>
    );
  }
}
