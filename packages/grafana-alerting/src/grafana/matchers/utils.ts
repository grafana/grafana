import { parseFlags } from '@grafana/data';

import { Label, LabelMatcher } from './types';

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

// returns a match results for given set of matchers (from a policy for instance) and a set of labels
export function matchLabels(matchers: LabelMatcher[], labels: Label[]): LabelMatchingResult {
  const matches = matchLabelsSet(matchers, labels);

  // create initial map of label => match result
  const details = labels.map<LabelMatchDetails>((_label, index) => ({
    labelIndex: index,
    match: false,
    matcher: null,
  }));

  // for each matcher, check which label it matched for
  matchers.forEach((matcher) => {
    const matchingLabelIndex = labels.findIndex((label) => isLabelMatch(matcher, label));

    // record that matcher for the label
    if (matchingLabelIndex > -1) {
      details[matchingLabelIndex].match = true;
      details[matchingLabelIndex].matcher = matcher;
    }
  });

  return { matches, details };
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
  if (!matchFunction) {
    throw new Error(`no such operator: ${matcherType}`);
  }

  return matchFunction(labelValue, matcherValue);
}

export function matchLabelsSet(matchers: LabelMatcher[], labels: Label[]): boolean {
  for (const matcher of matchers) {
    if (!isLabelMatchInSet(matcher, labels)) {
      return false;
    }
  }
  return true;
}
/**
 * Checks if a label matcher matches any of the labels in the provided set.
 */
function isLabelMatchInSet(matcher: LabelMatcher, labels: Label[]): boolean {
  const { label, type, value } = matcher;

  let labelValue = ''; // matchers that have no labels are treated as empty string label values
  const labelForMatcher = Object.fromEntries(labels)[label];
  if (labelForMatcher) {
    labelValue = labelForMatcher;
  }

  const matchFunction = OperatorFunctions[type];
  if (!matchFunction) {
    throw new Error(`no such operator: ${type}`);
  }

  try {
    // This can throw because the regex operators use the JavaScript regex engine
    // and "new RegExp()" throws on invalid regular expressions.
    //
    // This is usually a user-error (because matcher values are taken from user input)
    // but we're still logging this as a warning because it _might_ be a programmer error.
    return matchFunction(labelValue, value);
  } catch (err) {
    console.warn(err);
    return false;
  }
}

type OperatorPredicate = (labelValue: string, matcherValue: string) => boolean;
const OperatorFunctions: Record<LabelMatcher['type'], OperatorPredicate> = {
  '=': (lv, mv) => lv === mv,
  '!=': (lv, mv) => lv !== mv,
  // At the time of writing, Alertmanager compiles to another (anchored) Regular Expression,
  // so we should also anchor our UI matches for consistency with this behaviour
  // https://github.com/prometheus/alertmanager/blob/fd37ce9c95898ca68be1ab4d4529517174b73c33/pkg/labels/matcher.go#L69
  '=~': (lv, mv) => {
    const valueWithFlagsParsed = parseFlags(`^(?:${mv})$`);
    const re = new RegExp(valueWithFlagsParsed.cleaned, valueWithFlagsParsed.flags);
    return re.test(lv);
  },
  '!~': (lv, mv) => {
    const valueWithFlagsParsed = parseFlags(`^(?:${mv})$`);
    const re = new RegExp(valueWithFlagsParsed.cleaned, valueWithFlagsParsed.flags);
    return !re.test(lv);
  },
};
