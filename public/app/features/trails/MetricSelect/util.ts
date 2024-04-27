import { sceneGraph } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';
import { VAR_METRIC_SEARCH_TERMS } from '../shared';

import { MetricSearchTermsVariable } from './MetricSearchTermsVariable';

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

export function createSearchRegExp(whiteSpaceSeparatedTerms?: string) {
  if (!whiteSpaceSeparatedTerms) {
    return null;
  }

  const searchTerms = deriveSearchTermsFromInput(whiteSpaceSeparatedTerms);
  return createJSRegExpFromSearchTerms(searchTerms);
}

export function createJSRegExpFromSearchTerms(searchTerms: string[]) {
  const searchParts = searchTerms.map((part) => `(?=(.*${part.toLowerCase()}.*))`);

  if (searchParts.length === 0) {
    return null;
  }

  const regex = searchParts.join('');
  //  (?=(.*expr1.*)(?=(.*expr2.*))...
  // The ?=(...) lookahead allows us to match these in any order.
  return new RegExp(regex, 'igy');
}

export function createPromRegExp(searchTerms?: string[]) {
  const searchParts = getUniqueTerms(searchTerms)
    .filter((term) => term.length > 0)
    .map((term) => `(.*${term.toLowerCase()}.*)`);

  const count = searchParts.length;

  if (searchParts.length === 0) {
    // avoid match[] must contain at least one non-empty matcher
    return '..*';
  }

  const regex = `(?i:${searchParts.join('|')}){${count},${count}}`;
  // (?i:(.*expr_1.*)|.*expr_2.*)|...|.*expr_n.*){n,n}
  // ?i: to ignore case
  // {n,n} to ensure that it matches n times, one match per term
  //   - This isn't ideal, since it doesn't enforce that each unique term is matched,
  //     but it's the best we can do with the Promtetheus / Go stdlib implementation of regex.

  console.log('REGEX THIS', regex);
  return regex;
}

function getUniqueTerms(terms: string[] = []) {
  const set = new Set(terms.map((term) => term.toLowerCase().trim()));
  return Array.from(set);
}

export function getMetricSearchTerms(trail: DataTrail) {
  const searchTermVariable = sceneGraph.lookupVariable(VAR_METRIC_SEARCH_TERMS, trail);
  if (searchTermVariable instanceof MetricSearchTermsVariable) {
    return searchTermVariable.state.terms;
  }
  return [];
}
