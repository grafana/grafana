import { TokenTypes } from '../../monarch/types';
import { LANGUAGE_DEFINITION_ID } from '../definition';

export const LogsTokenTypes: TokenTypes = {
  Parenthesis: `delimiter.parenthesis.${LANGUAGE_DEFINITION_ID}`,
  Whitespace: `white.${LANGUAGE_DEFINITION_ID}`,
  Keyword: `keyword.${LANGUAGE_DEFINITION_ID}`,
  Delimiter: `delimiter.${LANGUAGE_DEFINITION_ID}`,
  Operator: `operator.${LANGUAGE_DEFINITION_ID}`,
  Identifier: `identifier.${LANGUAGE_DEFINITION_ID}`,
  Type: `type.${LANGUAGE_DEFINITION_ID}`,
  Function: `predefined.${LANGUAGE_DEFINITION_ID}`,
  Number: `number.${LANGUAGE_DEFINITION_ID}`,
  String: `string.${LANGUAGE_DEFINITION_ID}`,
  Variable: `variable.${LANGUAGE_DEFINITION_ID}`,
};
