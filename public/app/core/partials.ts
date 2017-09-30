var templates = (<any>require).context('../', true, /\.html$/);
templates.keys().forEach(function(key) {
  templates(key);
});
