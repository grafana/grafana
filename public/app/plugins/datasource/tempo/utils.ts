export const getErrorMessage = (message: string | undefined, prefix?: string) => {
  const err = message ? ` (${message})` : '';
  let errPrefix = prefix ? prefix : 'Error';
  return `${errPrefix}${err}. Please check the server logs for more details.`;
};
