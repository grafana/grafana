/* */ 
require('./legacy-compat');
var orig_require = require;
var require = function(file) {
  test(file, function() {
    orig_require(file);
  });
};
require('./add-listeners');
require('./check-listener-leaks');
require('./listeners-side-effects');
require('./listeners');
require('./max-listeners');
require('./modify-in-emit');
require('./num-args');
require('./once');
require('./set-max-listeners-side-effects');
require('./subclass');
require('./remove-all-listeners');
require('./remove-listeners');
