import { RegistryItem } from '@grafana/data';
import { monacoTypes } from '@grafana/ui';

import {
  CustomSuggestion,
  MacroType,
  OperatorType,
  PositionContext,
  StatementPosition,
  SuggestionKind,
} from '../types';
import { LinkedToken } from '../utils/LinkedToken';

export interface SuggestionsRegistryItem extends RegistryItem {
  id: SuggestionKind;
  suggestions: (position: PositionContext, m: typeof monacoTypes) => Promise<CustomSuggestion[]>;
}

export interface MacrosRegistryItem extends RegistryItem {
  type: MacroType;
  text: string;
  args?: string[];
}

export interface FunctionsRegistryItem extends RegistryItem {}
export interface OperatorsRegistryItem extends RegistryItem {
  operator: string;
  type: OperatorType;
}

export type StatementPositionResolver = (
  currentToken: LinkedToken | null,
  previousKeyword: LinkedToken | null,
  previousNonWhiteSpace: LinkedToken | null,
  previousIsSlash: Boolean
) => Boolean;

export interface StatementPositionResolversRegistryItem extends RegistryItem {
  id: StatementPosition;
  resolve: StatementPositionResolver;
}

export type SuggestionsResolver = <T extends PositionContext = PositionContext>(
  positionContext: T
) => Promise<CustomSuggestion[]>;

export interface SQLMonarchLanguage extends monacoTypes.languages.IMonarchLanguage {
  keywords?: string[];
  builtinFunctions?: string[];
  logicalOperators?: string[];
  comparisonOperators?: string[];
}
