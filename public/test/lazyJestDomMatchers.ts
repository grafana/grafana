/// <reference types="@testing-library/jest-dom" />
import type { MatchersStandalone } from '@testing-library/jest-dom/matchers';

type MatcherName = keyof MatchersStandalone;

function lazyMatcher(name: MatcherName): jest.CustomMatcher {
  return function (this: jest.MatcherContext, ...args: Parameters<jest.CustomMatcher>) {
    const matchers = require('@testing-library/jest-dom/matchers') as Record<MatcherName, jest.CustomMatcher>;
    return matchers[name].apply(this, args);
  };
}

// Keep every matcher available without loading the DOM assertion graph in suites that never use it.
export const jestDomMatchers = {
  toBeChecked: lazyMatcher('toBeChecked'),
  toBeDisabled: lazyMatcher('toBeDisabled'),
  toBeEmpty: lazyMatcher('toBeEmpty'),
  toBeEmptyDOMElement: lazyMatcher('toBeEmptyDOMElement'),
  toBeEnabled: lazyMatcher('toBeEnabled'),
  toBeInTheDOM: lazyMatcher('toBeInTheDOM'),
  toBeInTheDocument: lazyMatcher('toBeInTheDocument'),
  toBeInvalid: lazyMatcher('toBeInvalid'),
  toBePartiallyChecked: lazyMatcher('toBePartiallyChecked'),
  toBeRequired: lazyMatcher('toBeRequired'),
  toBeValid: lazyMatcher('toBeValid'),
  toBeVisible: lazyMatcher('toBeVisible'),
  toContainElement: lazyMatcher('toContainElement'),
  toContainHTML: lazyMatcher('toContainHTML'),
  toHaveAccessibleDescription: lazyMatcher('toHaveAccessibleDescription'),
  toHaveAccessibleErrorMessage: lazyMatcher('toHaveAccessibleErrorMessage'),
  toHaveAccessibleName: lazyMatcher('toHaveAccessibleName'),
  toHaveAttribute: lazyMatcher('toHaveAttribute'),
  toHaveClass: lazyMatcher('toHaveClass'),
  toHaveDescription: lazyMatcher('toHaveDescription'),
  toHaveDisplayValue: lazyMatcher('toHaveDisplayValue'),
  toHaveErrorMessage: lazyMatcher('toHaveErrorMessage'),
  toHaveFocus: lazyMatcher('toHaveFocus'),
  toHaveFormValues: lazyMatcher('toHaveFormValues'),
  toHaveRole: lazyMatcher('toHaveRole'),
  toHaveSelection: lazyMatcher('toHaveSelection'),
  toHaveStyle: lazyMatcher('toHaveStyle'),
  toHaveTextContent: lazyMatcher('toHaveTextContent'),
  toHaveValue: lazyMatcher('toHaveValue'),
} satisfies Record<MatcherName, jest.CustomMatcher>;
