(function(global) {

System.config({
  meta: {
    b: {
      deps: ['a']
    }
  }
});

define('a', [], function() {
  global.MODULEA = 'a';
});

define('b', [], function() {
  return {
    a: global.MODULEA
  };
});

})(typeof window == 'undefined' ? global : window);