const dev = require('../../webpack/webpack.dev.js');
const prod = require('../../webpack/webpack.prod.js');

module.exports = function() {
  'use strict';
  return {
    options: {
      stats: false,
    },
    dev: dev,
    prod: prod,
  };
};
