/* */ 
'use strict';
var elliptic = exports;
elliptic.version = require('../package.json!systemjs-json').version;
elliptic.utils = require('./elliptic/utils');
elliptic.rand = require('brorand');
elliptic.hmacDRBG = require('./elliptic/hmac-drbg');
elliptic.curve = require('./elliptic/curve/index');
elliptic.curves = require('./elliptic/curves');
elliptic.ec = require('./elliptic/ec/index');
elliptic.eddsa = require('./elliptic/eddsa/index');
