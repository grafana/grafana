'format global';
'deps ./global-dep.js';


(function(window) {
  window.newDep = jjQuery.v;
})(typeof window != 'undefined' ? window : global);