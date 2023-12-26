export const transformationsVariableSupport = () => {
  return (window as any)?.grafanaBootData?.settings?.featureToggles?.transformationsVariableSupport;
};
