import memoize from 'micro-memoize';

import { parseFlags } from '@grafana/data';

import { type Label, type LabelMatcher } from './types';

type LabelMatchingResult = {
  // wether all of the labels match the given set of matchers
  matches: boolean;
  // details of which labels matched which matcher
  details: LabelMatchDetails[];
};

// LabelMatchDetails is a map of labels to their match results
export type LabelMatchDetails = {
  labelIndex: number; // index of the label in the labels array
  match: boolean;
  matcher: LabelMatcher | null;
} & (PositiveLabelMatch | NegativeLabelMatch);

type PositiveLabelMatch = {
  match: true;
  matcher: LabelMatcher;
};
type NegativeLabelMatch = {
  match: false;
  matcher: null;
};

/**
 * The same list of labels, with two lookup tables built over it.
 *
 * Matching a route tree checks the same label set against hundreds or thousands of matchers, and
 * each of those checks needs to find one label by name. Doing that by name on the list means
 * walking it every time, so build the lookups once and reuse them for the whole tree.
 *
 * `valueByName` keeps the last value for a repeated label name, which is what turning the list
 * into an object used to give us. `indicesByName` keeps every position a name appears at, in
 * order, so the details below can look at exactly the labels a matcher could apply to.
 */
export type IndexedLabels = {
  labels: Label[];
  valueByName: Map<string, string>;
  indicesByName: Map<string, number[]>;
};

export function indexLabels(labels: Label[]): IndexedLabels {
  const valueByName = new Map<string, string>();
  const indicesByName = new Map<string, number[]>();

  labels.forEach(([name, value], index) => {
    valueByName.set(name, value);

    const indices = indicesByName.get(name);
    if (indices) {
      indices.push(index);
    } else {
      indicesByName.set(name, [index]);
    }
  });

  return { labels, valueByName, indicesByName };
}

// returns a match results for given set of matchers (from a policy for instance) and a set of labels
export function matchLabels(matchers: LabelMatcher[], labels: Label[]): LabelMatchingResult {
  return matchIndexedLabels(matchers, indexLabels(labels));
}

// same as matchLabels, for callers that already built the lookups and want to reuse them
export function matchIndexedLabels(matchers: LabelMatcher[], indexedLabels: IndexedLabels): LabelMatchingResult {
  const matches = matchIndexedLabelsSet(matchers, indexedLabels);

  // create initial map of label => match result
  const details = indexedLabels.labels.map<LabelMatchDetails>((_label, index) => ({
    labelIndex: index,
    match: false,
    matcher: null,
  }));

  // for each matcher, check which label it matched for
  matchers.forEach((matcher) => {
    const matchingLabelIndex = findMatchingLabelIndex(matcher, indexedLabels);

    // record that matcher for the label
    if (matchingLabelIndex > -1) {
      details[matchingLabelIndex].match = true;
      details[matchingLabelIndex].matcher = matcher;
    }
  });

  return { matches, details };
}

/**
 * The first label this matcher accepts, or -1 if there is none.
 *
 * This is the same answer as checking the matcher against every label in order, because a matcher
 * can only ever accept a label that carries its own name. Labels with a different name are skipped
 * without running the operator, so an invalid regular expression still only throws when the label
 * set actually carries that name.
 */
function findMatchingLabelIndex(matcher: LabelMatcher, indexedLabels: IndexedLabels): number {
  const indices = indexedLabels.indicesByName.get(matcher.label);
  if (!indices) {
    return -1;
  }

  const matchFunction = OperatorFunctions[matcher.type];
  for (const index of indices) {
    if (matchFunction(indexedLabels.labels[index][1], matcher.value)) {
      return index;
    }
  }

  return -1;
}

// ⚠️ DO NOT USE THIS FUNCTION FOR ROUTE SELECTION ALGORITHM
// for route selection algorithm, always compare a single matcher to the entire label set
// see "matchLabelsSet"
export function isLabelMatch(matcher: LabelMatcher, label: Label): boolean {
  const [labelKey, labelValue] = label;
  const { label: matcherLabel, type: matcherType, value: matcherValue } = matcher;

  if (labelKey !== matcherLabel) {
    return false;
  }

  const matchFunction = OperatorFunctions[matcherType];
  return matchFunction(labelValue, matcherValue);
}

export function matchLabelsSet(matchers: LabelMatcher[], labels: Label[]): boolean {
  return matchIndexedLabelsSet(matchers, indexLabels(labels));
}

// same as matchLabelsSet, but takes the prebuilt lookups so callers in here can reuse them
function matchIndexedLabelsSet(matchers: LabelMatcher[], indexedLabels: IndexedLabels): boolean {
  for (const matcher of matchers) {
    if (!isLabelMatchInSet(matcher, indexedLabels)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if a label matcher matches any of the labels in the provided set.
 */
function isLabelMatchInSet(matcher: LabelMatcher, indexedLabels: IndexedLabels): boolean {
  const { label, type, value } = matcher;

  // matchers that have no labels are treated as empty string label values
  const labelValue = indexedLabels.valueByName.get(label) || '';

  const matchFunction = OperatorFunctions[type];
  try {
    // This can throw because the regex operators use the JavaScript regex engine
    // and "new RegExp()" throws on invalid regular expressions.
    //
    // This is usually a user-error (because matcher values are taken from user input)
    return matchFunction(labelValue, value);
  } catch (err) {
    return false;
  }
}

// Compiling a regular expression is by far the most expensive thing in here, and route matching
// asks for the same matcher value over and over, so hold on to the compiled ones.
//
// Matcher values come from user input, and something like a label filter box will call in here on
// every keystroke, so cap the cache instead of letting it grow for the life of the page.
//
// Values that don't compile throw and are not cached. Callers above decide what to do with that,
// and recompiling a broken value is the rare path.
const compileAnchoredRegex = memoize(
  (matcherValue: string): RegExp => {
    // At the time of writing, Alertmanager compiles to another (anchored) Regular Expression,
    // so we should also anchor our UI matches for consistency with this behaviour
    // https://github.com/prometheus/alertmanager/blob/fd37ce9c95898ca68be1ab4d4529517174b73c33/pkg/labels/matcher.go#L69
    const valueWithFlagsParsed = parseFlags(`^(?:${matcherValue})$`);
    return new RegExp(valueWithFlagsParsed.cleaned, valueWithFlagsParsed.flags);
  },
  { maxSize: 500 }
);

function getAnchoredRegex(matcherValue: string): RegExp {
  const regex = compileAnchoredRegex(matcherValue);
  // A regex carrying the "g" flag remembers where the last match stopped, so rewind it first.
  regex.lastIndex = 0;
  return regex;
}

type OperatorPredicate = (labelValue: string, matcherValue: string) => boolean;
const OperatorFunctions: Record<LabelMatcher['type'], OperatorPredicate> = {
  '=': (lv, mv) => lv === mv,
  '!=': (lv, mv) => lv !== mv,
  '=~': (lv, mv) => getAnchoredRegex(mv).test(lv),
  '!~': (lv, mv) => !getAnchoredRegex(mv).test(lv),
};
