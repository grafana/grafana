// Every namespaced kind can serve /search and /trash, and no frontend calls them yet, so
// generating a hook per kind would add clients nobody imports. The dashboard search at
// `/search` is a different, older endpoint and stays.
const perResourceSearch = /^(?:\/apis\/[^/]+\/[^/]+)?\/[^/]+\/(search|trash)$/;

export function includeEndpoint(path: string): boolean {
  return !perResourceSearch.test(path);
}
