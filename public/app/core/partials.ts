let templates = (require as any).context('../', true, /\.html$/);
templates.keys().forEach(function(key) {
  templates(key);
});
