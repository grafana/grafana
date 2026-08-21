/*! @license fixture-license-notice: must be extracted to a sidecar */
// A UMD-wrapped dependency, standing in for the real ones plugins bundle.
// Whether its `define.amd` branch is resolved at build time or left for the
// runtime depends on the config's `amd` option.
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.umdDep = factory();
  }
})(globalThis, function () {
  return { marker: 'umd-dep-payload' };
});
