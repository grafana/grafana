/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

class NetCrunchConnectionCache {

  constructor() {
    this.connectionCache = new Map();
  }

  getConnectionKey(datasource) {    // eslint-disable-line
    return `${datasource.serverUrl}:${datasource.username}`;
  }

  addConnection(datasource, connection) {
    this.connectionCache.set(this.getConnectionKey(datasource), connection);
  }

  deleteConnection(datasource) {
    this.connectionCache.delete(this.getConnectionKey(datasource));
  }

  getConnection(datasource) {
    return this.connectionCache.get(this.getConnectionKey(datasource));
  }

  connectionExist(datasource) {
    return (this.getConnection(datasource) != null);
  }
}

export {
  NetCrunchConnectionCache
};
