let cachedToken = '';

export const loadUrlToken = (): string | null => {
  const params = new URLSearchParams(window.location.search);

  const token = params.get('auth_token');
  if (token !== null && token !== '') {
    cachedToken = token;
    return token;
  }

  return cachedToken;
};
