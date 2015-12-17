(function (root, factory) {
  if (typeof define === 'function' && define.amd)
    define(['./umd-dep.js'], function(dep) {
      return (root.amdWebGlobal = factory(dep));
    });
  else
    root.amdWebGlobal = factory(root.dep);
}(this, function(dep) {
  return { d: dep.dep };
}));
