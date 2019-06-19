'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./index.production.js');
} else {
  module.exports = require('./index.development.js');
}
