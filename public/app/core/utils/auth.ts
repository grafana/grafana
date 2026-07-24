export function getSessionExpiry() {
  const expiryCookie = document.cookie.split('; ').find((row) => row.startsWith('grafana_session_expiry='));
  if (!expiryCookie) {
    return 0;
  }

  let expiresStr = expiryCookie.split('=').at(1);
  if (!expiresStr) {
    return 0;
  }

  return parseInt(expiresStr, 10);
}

export function hasSessionExpiry() {
  return document.cookie.split('; ').findIndex((row) => row.startsWith('grafana_session_expiry=')) > -1;
}
