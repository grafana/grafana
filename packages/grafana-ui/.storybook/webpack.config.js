const path = require('path');

module.exports = async ({ config, mode }) => {
  config.node = { fs: 'empty' };
  return config;
};
