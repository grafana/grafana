(function(window) {
  if (false)
    define(function() {
    });
  window.test = 'global';
})(typeof window != 'undefined' ? window : global);