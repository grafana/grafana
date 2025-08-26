import { TokenTypes } from '../monarch/types';

import { CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID } from './language';

interface IpplTokenTypes extends TokenTypes {
  Pipe: string;
  Backtick: string;
  Command: string;
}

export const PPLTokenTypes: IpplTokenTypes = {
  Parenthesis: `delimiter.parenthesis.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Whitespace: `white.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Keyword: `keyword.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Command: `keyword.command.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Delimiter: `delimiter.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Pipe: `delimiter.pipe.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Operator: `operator.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Identifier: `identifier.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Type: `type.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Function: `predefined.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Number: `number.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  String: `string.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Variable: `variable.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Comment: `comment.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Regexp: `regexp.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
  Backtick: `string.backtick.${CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID}`,
};
