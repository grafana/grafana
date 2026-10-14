import { type SearchLeaf, filterLeaf } from './pages/RuleListPage';

// Three rules per journey: `Payments rule` has team=payments, `Checkout rule` team=checkout and
// `Unowned rule` no team label, so every operator has a rule that must match and one that must not.
export const LABEL_RULES = {
  payments: 'Payments rule',
  checkout: 'Checkout rule',
  unowned: 'Unowned rule',
};

export interface LabelFilterCase {
  operator: string;
  token: string;
  leaf: SearchLeaf;
  shown: string[];
  hidden: string[];
}

// Not-equal and absent also match rules that lack the label (`NotIn` includes missing values), so
// the unowned rule is shown for them. A negated regex is only asserted on rules that carry the label,
// because how missing labels count for a negated pattern is the backend's contract, not this page's.
export const labelFilterCases: LabelFilterCase[] = [
  {
    operator: 'equals',
    token: 'label:team=payments',
    leaf: filterLeaf('labels', 'In', ['team=payments']),
    shown: [LABEL_RULES.payments],
    hidden: [LABEL_RULES.checkout, LABEL_RULES.unowned],
  },
  {
    operator: 'does not equal',
    token: 'label:team!=payments',
    leaf: filterLeaf('labels', 'NotIn', ['team=payments']),
    shown: [LABEL_RULES.checkout, LABEL_RULES.unowned],
    hidden: [LABEL_RULES.payments],
  },
  {
    operator: 'exists',
    token: 'label:team',
    leaf: filterLeaf('labels', 'In', ['team']),
    shown: [LABEL_RULES.payments, LABEL_RULES.checkout],
    hidden: [LABEL_RULES.unowned],
  },
  {
    operator: 'is absent',
    token: 'label:!team',
    leaf: filterLeaf('labels', 'NotIn', ['team']),
    shown: [LABEL_RULES.unowned],
    hidden: [LABEL_RULES.payments, LABEL_RULES.checkout],
  },
  {
    operator: 'matches a regex',
    token: 'label:team=~pay.*',
    leaf: { regex: { field: 'labels', pattern: 'team=pay.*' } },
    shown: [LABEL_RULES.payments],
    hidden: [LABEL_RULES.checkout, LABEL_RULES.unowned],
  },
  {
    operator: 'does not match a regex',
    token: 'label:team!~pay.*',
    leaf: { regex: { field: 'labels', pattern: 'team=pay.*', negate: true } },
    shown: [LABEL_RULES.checkout],
    hidden: [LABEL_RULES.payments],
  },
];
