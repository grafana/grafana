
(function(window) {
  if (!('errorOnAccess' in window))
    throw Error();

  window.test = 'result of global-inaccessible-props';

})(typeof window != 'undefined' ? window : global);
