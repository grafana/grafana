export const toComparablePath = (url: string, appSubUrl = ''): string => {
  const pathOnly = url.split(/[?#]/, 1)[0];
  const prefix = appSubUrl.replace(/\/+$/, '');
  const unprefixed = prefix && pathOnly.startsWith(prefix) ? pathOnly.slice(prefix.length) : pathOnly;
  return unprefixed.replace(/\/+$/, '') || '/';
};
