import { TokenTypes } from '../../monarch/types';
import { CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID } from '../definition';

export const SQLTokenTypes: TokenTypes = {
  Parenthesis: `delimiter.parenthesis.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  Whitespace: `white.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  Keyword: `keyword.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  Delimiter: `delimiter.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  Operator: `operator.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  Identifier: `identifier.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  Type: `type.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  Function: `predefined.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  Number: `number.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  String: `string.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  Variable: `variable.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  Comment: `comment.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
  Regexp: `regexp.${CLOUDWATCH_LOGS_SQL_LANGUAGE_DEFINITION_ID}`,
};
