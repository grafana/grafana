let templates = (require as any).context('../', true, /\.html$/);
templates.keys().forEach(key => {
  templates(key);
});
