'use strict';
const { cloneDeep } = require('lodash');

const overrideWebpackConfig = (originalConfig, options) => {
  const config = cloneDeep(originalConfig);
  config.name = 'customConfig';
  return config;
};

module.exports = overrideWebpackConfig;
