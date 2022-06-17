let cachedToken = '';

export const loadUrlToken = (): string | null => {
  if (cachedToken !== '') {
    return cachedToken;
  }

  const params = new URLSearchParams(window.location.search);
  const token = params.get('auth_token');
  if (token !== null && token !== '') {
    cachedToken = token;
  }

  return token;
};
