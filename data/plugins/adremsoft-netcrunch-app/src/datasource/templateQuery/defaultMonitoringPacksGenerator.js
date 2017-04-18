/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

const PRIVATE_PROPERTIES = {
  datasource: Symbol('datasource')
};

class NetCrunchDefaultMonitoringPacksGenerator {

  constructor(datasource) {
    this[PRIVATE_PROPERTIES.datasource] = datasource;
  }

  static readMonitoringPacks(monitoringPacks) {
    const result = {
      id: monitoringPacks.netId,
      children: {}
    };

    monitoringPacks.children.forEach((child) => {
      result.children[child.displayName] = NetCrunchDefaultMonitoringPacksGenerator.readMonitoringPacks(child);
    });

    return result;
  }

  printMonitoringPacks() {
    this[PRIVATE_PROPERTIES.datasource].atlas()
      .then((atlas) => {
        const monitoringPacks = NetCrunchDefaultMonitoringPacksGenerator.readMonitoringPacks(atlas.monitoringPacks);
        console.log(JSON.stringify(monitoringPacks));         // eslint-disable-line
      });
  }

}

export {
  NetCrunchDefaultMonitoringPacksGenerator
};
