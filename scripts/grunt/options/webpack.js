const dev = require('../../webpack/webpack.dev.js');
const prod = require('../../webpack/webpack.prod.js');

module.exports = function() {
  'use strict';
  return {
    options: {
      stats: !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
    },
    dev: dev,
    prod: prod
  };
};
