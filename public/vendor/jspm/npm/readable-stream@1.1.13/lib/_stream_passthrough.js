/* */ 
module.exports = PassThrough;
var Transform = require('./_stream_transform');
var util = require('core-util-is');
util.inherits = require('inherits');
util.inherits(PassThrough, Transform);
function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);
  Transform.call(this, options);
}
PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};
