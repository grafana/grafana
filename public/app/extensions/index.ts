let components = (require as any).context('.', true, /\.tsx?/);
components.keys().forEach(key => {
  console.log('extension component', components(key));
});
