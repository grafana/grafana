/* */ 
(function(Buffer, process) {
  var compat = require('./browser');
  process.on('message', function(m) {
    try {
      var result = compat.pbkdf2Sync(new Buffer(m.password, 'hex'), new Buffer(m.salt, 'hex'), m.iterations, m.keylen, m.digest);
      process.send({
        data: result.toString('hex'),
        type: 'success'
      });
    } catch (e) {
      process.send({
        data: e && e.message,
        type: 'fail'
      });
    } finally {
      process.exit();
    }
  });
})(require('buffer').Buffer, require('process'));
