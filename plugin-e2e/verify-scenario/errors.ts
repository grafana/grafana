export const formatExpectError = (message: string) => {
  return `@grafana/plugin-e2e error: ${message}. 
    See https://github.com/grafana/grafana/blob/main/plugin-e2e/verify-scenario/README.md for more information.`;
};
