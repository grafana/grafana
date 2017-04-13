/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

import { datasourceURL } from '../common';

class NetCrunchDatasourceConfigCtrl {

  constructor() {
    this.updateURL();
  }

  get simpleURL() {
    return this.current.jsonData.simpleUrl;
  }

  get isSSL() {
    return this.current.jsonData.isSSL;
  }

  get protocol() {
    return (this.isSSL === true) ? 'https://' : 'http://';
  }

  updateURL() {
    this.current.access = 'proxy';
    this.current.url = this.protocol + this.simpleURL;
  }

  serverAddressChange() {
    this.updateURL();
  }

  isSSLClick() {
    this.updateURL();
  }

  static get templateUrl() {
    return `${datasourceURL}config/config.html`;
  }

  static set templateUrl(value) {   // eslint-disable-line
  }

}

export {
  NetCrunchDatasourceConfigCtrl
};
