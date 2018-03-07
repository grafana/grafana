/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

import { datasourceURL } from '../common';

class NetCrunchQueryOptionsController {

  constructor() {
    this.MAX_SAMPLE_COUNT = this.datasource.MAX_SAMPLE_COUNT;
    this.setDefaults();
    this.checkMaxDataPoints();
  }

  get datasource() {
    return this.panelCtrl.datasource;
  }

  get panel() {
    return this.panelCtrl.panel;
  }

  setDefaults() {
    const
      DEFAULT_QUERY_OPTIONS = {
        maxDataPoints: this.MAX_SAMPLE_COUNT.DEFAULT,
        rawData: false,
        setMaxDataPoints: false
      };

    if (this.panel.scopedVars == null) {
      this.panel.scopedVars = DEFAULT_QUERY_OPTIONS;
    } else {
      Object.keys(DEFAULT_QUERY_OPTIONS)
        .forEach((option) => {
          if (this.panel.scopedVars[option] == null) {
            this.panel.scopedVars[option] = DEFAULT_QUERY_OPTIONS[option];
          }
        });
    }
  }

  checkMaxDataPoints() {
    const scopedVars = this.panel.scopedVars;
    if (!((scopedVars.maxDataPoints >= this.MAX_SAMPLE_COUNT.MIN) &&
          (scopedVars.maxDataPoints <= this.MAX_SAMPLE_COUNT.MAX))) {
      scopedVars.maxDataPoints = this.MAX_SAMPLE_COUNT.DEFAULT;
    }
  }

  metricOptionsChange() {
    this.panelCtrl.refresh();
  }

  static get templateUrl() {
    return `${datasourceURL}query/query.options.html`;
  }

  static set templateUrl(value) {   // eslint-disable-line
  }

}

export {
  NetCrunchQueryOptionsController
};
