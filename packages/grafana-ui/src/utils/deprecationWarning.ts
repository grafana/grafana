export const deprecationWarning = (file: string, oldName: string, newName?: string) => {
  let message = `[Deprecation warning] ${file}: ${oldName} is deprecated`;
  if (newName) {
    message += `.  Use ${newName} instead`;
  }
  console.warn(message);
};
