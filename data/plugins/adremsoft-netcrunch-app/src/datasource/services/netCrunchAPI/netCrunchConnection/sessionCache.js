/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

class NetCrunchSessionCache {

  addSection(sectionName) {
    this[sectionName] = new Map();
  }

  getSection(sectionName) {
    return this[sectionName];
  }

  addToCache(sectionName, key, value) {

    if (this.getSection(sectionName) == null) {
      this.addSection(sectionName);
    }

    this.getSection(sectionName).set(key, {
      timeStamp: new Date().getTime(),
      value
    });
  }

  getFromCache(sectionName, key) {
    if (this.getSection(sectionName) != null) {
      if (this.getSection(sectionName).has(key)) {
        return this.getSection(sectionName).get(key).value;
      }
      return null;
    }
    return null;
  }

}

export {
  NetCrunchSessionCache
};
