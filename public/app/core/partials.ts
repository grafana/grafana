
declare var require: any;
var templates = require.context('../', true, /\.html$/);
templates.keys().forEach(function(key) {
  templates(key);
});
