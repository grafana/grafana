export const getErrorResponse = (message: string, code: number) => {
  return {
    kind: 'Status',
    apiVersion: 'v1',
    metadata: {},
    status: 'Failure',
    message,
    code,
  };
};
