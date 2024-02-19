export const formatExpectError = (message: string) => {
  return `Error while verifying @grafana/plugin-e2e scenarios: ${message}. 
    See https://github.com/grafana/grafana/blob/main/plugin-e2e/verify-scenario/README.md for more information.`;
};
