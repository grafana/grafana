module.exports = NonError;
var util = require('util');

function NonError(value) {
  // Format a reasonable message from `value`.
  var message;
  try {
    message = util.inspect(value);
  } catch (e) {
    message = e.message;
  }

  this.message = message;
  this.value = value;

  Error.captureStackTrace(this, NonError);
}

NonError.prototype = Object.create(Error.prototype);
