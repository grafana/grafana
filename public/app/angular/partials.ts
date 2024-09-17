let templates = (require as any).context('../', true, /\.html$/);
templates.keys().forEach((key: string) => {
  templates(key);
});
