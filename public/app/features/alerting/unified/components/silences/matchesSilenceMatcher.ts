import { Matcher } from 'app/plugins/datasource/alertmanager/types';

export function matchesSilenceMatcher(filter: Matcher, silenceMatcher: Matcher): boolean {
  if (filter.name !== silenceMatcher.name) {
    return false;
  }

  if (filter.isRegex) {
    try {
      const re = new RegExp(`^(?:${filter.value})$`);
      const valueMatches = re.test(silenceMatcher.value);
      return filter.isEqual ? valueMatches : !valueMatches;
    } catch {
      return false;
    }
  }

  const valueEquals = filter.value === silenceMatcher.value;
  return filter.isEqual ? valueEquals : !valueEquals;
}
