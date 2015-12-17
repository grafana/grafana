// we define a __exec for globally-scoped execution
// used by module format implementations
var __exec;

(function() {

  // System clobbering protection (mostly for Traceur)
  var curSystem;
  var callCounter = 0;
  var curLoad;
  function preExec(loader, load) {
    if (callCounter++ == 0)
      curSystem = __global.System;
    __global.System = loader;
    curLoad = load;
  }
  function postExec() {
    if (--callCounter == 0)
      __global.System = curSystem;
    curLoad = undefined;
  }

  // System.register, System.registerDynamic, AMD define pipeline
  // if currently evalling code here, immediately reduce the registered entry against the load record
  hook('pushRegister_', function() {
    return function(register) {
      if (!curLoad)
        return false;

      this.reduceRegister_(curLoad, register);
      return true;
    };
  });

  var hasBtoa = typeof btoa != 'undefined';

  function getSource(load) {
    var lastLineIndex = load.source.lastIndexOf('\n');

    // wrap ES formats with a System closure for System global encapsulation
    var wrap = load.metadata.format == 'esm' || load.metadata.format == 'register' || load.metadata.bundle;

    return (wrap ? '(function(System) {' : '') + load.source + (wrap ? '\n})(System);' : '')
        // adds the sourceURL comment if not already present
        + (load.source.substr(lastLineIndex, 15) != '\n//# sourceURL=' 
          ? '\n//# sourceURL=' + load.address + (load.metadata.sourceMap ? '!transpiled' : '') : '')
        // add sourceMappingURL if load.metadata.sourceMap is set
        + (load.metadata.sourceMap && hasBtoa && 
          '\n//# sourceMappingURL=data:application/json;base64,' + btoa(unescape(encodeURIComponent(load.metadata.sourceMap))) || '')
  }

  function evalExec(load) {
    if (load.metadata.integrity)
      throw new TypeError('Subresource integrity checking is not supported in Web Workers or Chrome Extensions.');
    try {
      preExec(this, load);
      new Function(getSource(load)).call(__global);
      postExec();
    }
    catch(e) {
      postExec();
      throw addToError(e, 'Evaluating ' + load.address);
    }
  }

  // use script injection eval to get identical global script behaviour
  if (typeof document != 'undefined' && document.getElementsByTagName) {
    var head;

    var scripts = document.getElementsByTagName('script');
    $__curScript = scripts[scripts.length - 1];
    __exec = function(load) {
      if (!this.globalEvaluationScope)
        return evalExec.call(this, load);

      if (!head)
        head = document.head || document.body || document.documentElement;

      var script = document.createElement('script');
      script.text = getSource(load);
      var onerror = window.onerror;
      var e;
      window.onerror = function(_e) {
        e = addToError(_e, 'Evaluating ' + load.address);
      }
      preExec(this, load);

      if (load.metadata.integrity)
        script.setAttribute('integrity', load.metadata.integrity);
      if (load.metadata.nonce)
        script.setAttribute('nonce', load.metadata.nonce);

      head.appendChild(script);
      head.removeChild(script);
      postExec();
      window.onerror = onerror;
      if (e)
        throw e;
    };
  }

  // global scoped eval for node
  else if (typeof require != 'undefined') {
    var vmModule = 'vm';
    var vm = require(vmModule);
    __exec = function vmExec(load) {
      if (!this.globalEvaluationScope)
        return evalExec.call(this, load);

      if (load.metadata.integrity)
        throw new TypeError('Subresource integrity checking is unavailable in Node.');
      try {
        preExec(this, load);
        vm.runInThisContext(getSource(load));
        postExec();
      }
      catch(e) {
        postExec();
        throw addToError(e.toString(), 'Evaluating ' + load.address);
      }
    };
  }
  else {
    __exec = evalExec;
  }

})();