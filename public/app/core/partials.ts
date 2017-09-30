
declare var require: any;
var templates = require.context('../', true, /\.html$/);
templates.keys().forEach(function(key) {
  console.log('loading ' + key);
  templates(key);
});
