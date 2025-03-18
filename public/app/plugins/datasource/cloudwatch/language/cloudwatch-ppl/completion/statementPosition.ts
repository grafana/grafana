import { LinkedToken } from '../../monarch/LinkedToken';
import { StatementPosition } from '../../monarch/types';
import {
  ARITHMETIC_OPERATORS,
  PARAMETERS_WITH_BOOLEAN_VALUES,
  BY,
  COMPARISON_OPERATORS,
  CONDITION_FUNCTIONS,
  DEDUP,
  EVAL,
  EVENTSTATS,
  FIELD_OPERATORS,
  FIELDS,
  HEAD,
  IN,
  LOGICAL_EXPRESSION_OPERATORS,
  NOT,
  RARE,
  SORT,
  SORT_FIELD_FUNCTIONS,
  SPAN,
  STATS,
  STATS_FUNCTIONS,
  TOP,
  WHERE,
  PARSE,
  BETWEEN,
  EVAL_FUNCTIONS,
} from '../language';
import { PPLTokenTypes } from '../tokenTypes';

// getStatementPosition returns the 'statement position' of the place where the cursor is currently positioned.
// Statement positions are places that are syntactically and relevant for the evaluated language and are used to determine the suggestionKinds, i.e.
// suggestions in the dropdown.
// For example, in PPL, if the cursor is currently at the whitespace after the WHERE keyword, this function returns StatementPosition.BeforeLogicalExpression.
// In getSuggestionKinds, this position will result in SuggestionKind.LogicalExpression.
// Lastly, In PPLCompletionItemProvider appropriate suggestions of logical operators are added to the dropdown based on the suggestion kind.

export const getStatementPosition = (currentToken: LinkedToken | null): StatementPosition => {
  const previousNonWhiteSpace = currentToken?.getPreviousNonWhiteSpaceToken();
  const nextNonWhiteSpace = currentToken?.getNextNonWhiteSpaceToken();

  const normalizedPreviousNonWhiteSpace = previousNonWhiteSpace?.value?.toLowerCase();

  if (
    currentToken === null ||
    (currentToken?.isWhiteSpace() && previousNonWhiteSpace === null && nextNonWhiteSpace === null) ||
    (previousNonWhiteSpace?.is(PPLTokenTypes.Pipe) && currentToken?.isWhiteSpace()) ||
    previousNonWhiteSpace?.is(PPLTokenTypes.Delimiter, '|')
  ) {
    return StatementPosition.NewCommand;
  }

  switch (normalizedPreviousNonWhiteSpace) {
    case WHERE:
      return StatementPosition.BeforeLogicalExpression;
    case DEDUP:
      return StatementPosition.FieldList;
    case FIELDS:
      return StatementPosition.AfterFieldsCommand;
    case EVENTSTATS:
    case STATS:
      return StatementPosition.AfterStatsCommand;
    case SORT:
      return StatementPosition.SortField;
    case PARSE:
      return StatementPosition.Expression;
  }

  if (
    currentToken?.isWhiteSpace() ||
    currentToken?.is(PPLTokenTypes.Backtick) ||
    currentToken?.is(PPLTokenTypes.Delimiter, ',') ||
    currentToken?.is(PPLTokenTypes.Parenthesis) // for STATS functions
  ) {
    const nearestFunction = currentToken?.getPreviousOfType(PPLTokenTypes.Function)?.value.toLowerCase();
    const nearestKeyword = currentToken?.getPreviousOfType(PPLTokenTypes.Keyword)?.value.toLowerCase();
    const nearestCommand = currentToken?.getPreviousOfType(PPLTokenTypes.Command)?.value.toLowerCase();

    if (normalizedPreviousNonWhiteSpace) {
      if (
        nearestCommand !== FIELDS && // FIELDS and SORT fields can be preceeded by a + or - which are not arithmetic ops
        nearestCommand !== SORT &&
        ARITHMETIC_OPERATORS.includes(normalizedPreviousNonWhiteSpace)
      ) {
        return StatementPosition.AfterArithmeticOperator;
      }
      if (PARAMETERS_WITH_BOOLEAN_VALUES.includes(normalizedPreviousNonWhiteSpace)) {
        return StatementPosition.AfterBooleanArgument;
      }
    }

    const isBeforeLogicalExpression =
      (normalizedPreviousNonWhiteSpace &&
        (COMPARISON_OPERATORS.includes(normalizedPreviousNonWhiteSpace) ||
          LOGICAL_EXPRESSION_OPERATORS.includes(normalizedPreviousNonWhiteSpace))) ||
      previousNonWhiteSpace?.is(PPLTokenTypes.Regexp) ||
      normalizedPreviousNonWhiteSpace === NOT || // follows a comparison operator, logical operator, NOT or a regex
      (nearestFunction && CONDITION_FUNCTIONS.includes(nearestFunction) && normalizedPreviousNonWhiteSpace === ')'); // it's not a condition function argument

    if (
      nearestCommand !== SORT && // sort command fields can be followed by a field operator, which is handled lower in the block
      nearestCommand !== EVAL && // eval fields can be followed by an eval clause, which is handled lower in the block
      nearestCommand !== STATS && // identifiers in STATS can be followed by a stats function, which is handled lower in the block
      (isListingFields(currentToken) || currentToken?.is(PPLTokenTypes.Backtick))
    ) {
      return StatementPosition.FieldList;
    }

    if (
      nearestCommand !== EVAL && // eval can have StatementPosition.Expression after an equal operator
      isBeforeLogicalExpression
    ) {
      return StatementPosition.BeforeLogicalExpression;
    }

    if (nearestKeyword === IN) {
      return StatementPosition.AfterINKeyword;
    }
    if (nearestKeyword === BETWEEN) {
      return StatementPosition.FunctionArg;
    }

    if (
      nearestFunction &&
      (currentToken?.is(PPLTokenTypes.Parenthesis) || currentToken?.getNextNonWhiteSpaceToken()?.value === ')')
    ) {
      if ([...EVAL_FUNCTIONS, ...CONDITION_FUNCTIONS].includes(nearestFunction)) {
        return StatementPosition.FunctionArg;
      }
      if (STATS_FUNCTIONS.includes(nearestFunction)) {
        return StatementPosition.StatsFunctionArgument;
      }
      if (SORT_FIELD_FUNCTIONS.includes(nearestFunction)) {
        return StatementPosition.SortFieldExpression;
      }
    }

    switch (nearestCommand) {
      case SORT: {
        if (previousNonWhiteSpace) {
          if (previousNonWhiteSpace.is(PPLTokenTypes.Delimiter, ',')) {
            return StatementPosition.SortField;
          } else if (FIELD_OPERATORS.includes(previousNonWhiteSpace.value)) {
            return StatementPosition.SortFieldExpression;
          }
        }
        break;
      }
      case DEDUP: {
        // if current active command is DEDUP and there are identifiers (fieldNames) between currentToken and the dedup command
        const fieldNames = currentToken.getPreviousUntil(PPLTokenTypes.Number, [
          PPLTokenTypes.Delimiter,
          PPLTokenTypes.Whitespace,
        ]);
        if (fieldNames?.length && !havePipe(fieldNames)) {
          return StatementPosition.AfterDedupFieldNames;
        }
        return StatementPosition.FieldList;
      }
      case FIELDS: {
        return StatementPosition.FieldList;
      }
      case STATS:
      case EVENTSTATS: {
        if (nearestKeyword === BY && currentToken.isWhiteSpace()) {
          return StatementPosition.AfterStatsBy;
        } else if (nearestFunction === SPAN && currentToken?.is(PPLTokenTypes.Parenthesis)) {
          return StatementPosition.FieldList;
        }
        return StatementPosition.AfterStatsCommand;
      }
      case RARE: {
        return StatementPosition.FieldList;
      }
      case TOP: {
        return StatementPosition.FieldList;
      }
      case HEAD:
        return StatementPosition.AfterHeadCommand;

      case EVAL:
        if (previousNonWhiteSpace?.value === '=') {
          return StatementPosition.Expression;
        }
        if (
          currentToken?.isWhiteSpace() &&
          (normalizedPreviousNonWhiteSpace === EVAL || previousNonWhiteSpace?.is(PPLTokenTypes.Delimiter, ','))
        ) {
          return StatementPosition.EvalClause;
        }
        if (isBeforeLogicalExpression) {
          return StatementPosition.BeforeLogicalExpression;
        }
        break;
    }
  }

  return StatementPosition.Unknown;
};

const havePipe = (fieldNames: LinkedToken[]) => {
  return fieldNames?.some((word) => word.type === PPLTokenTypes.Pipe);
};
const isListingFields = (currentToken: LinkedToken | null) => {
  const tokensUntilFieldName = currentToken?.getPreviousUntil(PPLTokenTypes.Identifier, [PPLTokenTypes.Whitespace]); // tokens until exampleFieldName
  const tokensUntilEscapedFieldName = currentToken?.getPreviousUntil(PPLTokenTypes.Backtick, [
    // tokens until `@exampleFieldName`
    PPLTokenTypes.Whitespace,
  ]);
  const isPreceededByAFieldName =
    (tokensUntilFieldName?.length && tokensUntilFieldName.every((token) => token.is(PPLTokenTypes.Delimiter, ','))) ||
    (tokensUntilEscapedFieldName?.length &&
      tokensUntilEscapedFieldName.every((token) => token.is(PPLTokenTypes.Delimiter, ',')));
  const isAfterComma =
    currentToken?.isWhiteSpace() && currentToken?.getPreviousNonWhiteSpaceToken()?.is(PPLTokenTypes.Delimiter, ',');
  const isFunctionArgument = currentToken?.getNextNonWhiteSpaceToken()?.value === ')'; // is not e.g. span(`@timestamp`, 5m)

  return isAfterComma && isPreceededByAFieldName && !isFunctionArgument;
};
