import store from 'app/core/store';

export const loadUrlToken = (): string | null => {
  if (store.get('auth_token')) {
    return store.get('auth_token');
  }

  const params = new URLSearchParams(window.location.search);
  const token = params.get('auth_token');
  if (token !== null && token !== '') {
    // store token in local storage
    store.set('auth_token', token);
    // strip auth_token from url
    params.delete('auth_token');
    window.history.replaceState(null, '', `${window.origin}/${params.toString()}`);
  }

  return token;
};
