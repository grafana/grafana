const propDeprecationWarning = (componentName: string, propName: string, newPropName: string) => {
  const message = `[Deprecation warning] ${componentName}: ${propName} is deprecated. Use ${newPropName} instead`;
  console.warn(message);
};

export default propDeprecationWarning;
