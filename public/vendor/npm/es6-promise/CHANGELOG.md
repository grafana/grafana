# Master

# 3.0.2

* correctly bump both bower and package.json versions

# 3.0.1

* no longer include dist/test in npm releases

# 3.0.0

* use nextTick() instead of setImmediate() to schedule microtasks with node 0.10. Later versions of 
  nodes are not affected as they were already using nextTick(). Note that using nextTick() might 
  trigger a depreciation warning on 0.10 as described at https://github.com/cujojs/when/issues/410.
  The reason why nextTick() is preferred is that is setImmediate() would schedule a macrotask 
  instead of a microtask and might result in a different scheduling.
  If needed you can revert to the former behavior as follow:

    var Promise = require('es6-promise').Promise;
    Promise._setScheduler(setImmediate);

# 2.0.0

* re-sync with RSVP. Many large performance improvements and bugfixes.

# 1.0.0

* first subset of RSVP
