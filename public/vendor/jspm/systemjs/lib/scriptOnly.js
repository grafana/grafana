/*
 * Script-only addition used for production loader
 *
 */
hookConstructor(function(constructor) {
  return function() {
    constructor.apply(this, arguments);

    // prepare amd define
    if (this.has('@@amd-helpers'))
      this.get('@@amd-helpers').createDefine();
  };
});

hook('fetch', function(fetch) {
  return function(load) {
    load.metadata.scriptLoad = true;
    return fetch.call(this, load);
  };
});