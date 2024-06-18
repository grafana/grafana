// Consider any sequence of characters not permitted for metric names as a sepratator
const splitSeparator = /[^a-z0-9_:]+/;

export function deriveSearchTermsFromInput(whiteSpaceSeparatedTerms?: string) {
  return (
    whiteSpaceSeparatedTerms
      ?.toLowerCase()
      .split(splitSeparator)
      .filter((term) => term.length > 0) || []
  );
}

export function createJSRegExpFromSearchTerms(searchQuery?: string) {
  const searchParts = deriveSearchTermsFromInput(searchQuery).map((part) => `(?=(.*${part.toLowerCase()}.*))`);

  if (searchParts.length === 0) {
    return null;
  }

  const regex = searchParts.join('');
  //  (?=(.*expr1.*)(?=(.*expr2.*))...
  // The ?=(...) lookahead allows us to match these in any order.
  return new RegExp(regex, 'igy');
}

export function createPromRegExp(searchQuery?: string) {
  const searchParts = getUniqueTerms(deriveSearchTermsFromInput(searchQuery))
    .filter((term) => term.length > 0)
    .map((term) => `(.*${term.toLowerCase()}.*)`);

  const count = searchParts.length;

  if (searchParts.length === 0) {
    // avoid match[] must contain at least one non-empty matcher
    return null; //'..*';
  }

  const regex = `(?i:${searchParts.join('|')}){${count}}`;
  // (?i:(.*expr_1.*)|.*expr_2.*)|...|.*expr_n.*){n}
  // ?i: to ignore case
  // {n} to ensure that it matches n times, one match per term
  //   - This isn't ideal, since it doesn't enforce that each unique term is matched,
  //     but it's the best we can do with the Prometheus / Go stdlib implementation of regex.

  return regex;
}

function getUniqueTerms(terms: string[] = []) {
  const set = new Set(terms.map((term) => term.toLowerCase().trim()));
  return Array.from(set);
}
