let cachedToken = '';

export const loadUrlToken = (): string | null => {
  if (cachedToken !== '') {
    return cachedToken;
  }

  const params = new URLSearchParams(window.location.search);
  const token = params.get('auth_token');
  if (token !== null && token !== '') {
    cachedToken = token;
    // strip auth_token from url
    params.delete('auth_token');
    window.history.replaceState(null, '', `${window.origin}/${params.toString()}`);
  }

  return token;
};
