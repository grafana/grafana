const deprecationWarning = (file: string, oldName: string, newName: string) => {
  const message = `[Deprecation warning] ${file}: ${oldName} is deprecated. Use ${newName} instead`;
  console.warn(message);
};

export default deprecationWarning;
