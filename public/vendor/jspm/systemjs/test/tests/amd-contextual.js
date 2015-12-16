define(['require', 'module'], function(require, module) {
  return {
    name: module.uri,
    rel: require.toUrl('../rel-path.js')
  };
});