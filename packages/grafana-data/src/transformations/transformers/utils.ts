import { BootData } from '../../types/config';
import { DataFrame, Field } from '../../types/dataFrame';

declare global {
  interface Window {
    grafanaBootData?: BootData;
  }
}
/**
 * Retrieve the maximum number of fields in a series of a dataframe.
 */
export function findMaxFields(data: DataFrame[]) {
  let maxFields = 0;

  // Group to nested table needs at least two fields
  // a field to group on and to show in the nested table
  for (const frame of data) {
    if (frame.fields.length > maxFields) {
      maxFields = frame.fields.length;
    }
  }

  return maxFields;
}

export interface TemplateToken {
  token: string;
  fieldName: string;
  fillChar?: string;
  alignment?: string;
  width: number;
}

/**
 * Extract all template tokens from a string along with any padding modifiers.
 */
export function parseTemplateTokens(templateString: string): TemplateToken[] {
  const matchExpr = /{(?<fieldName>[\w\d\._-]+)(?::(?<fillChar>.?(?=[<>^]))?(?<alignment>[<>^])?(?<width>\d+))?}/g;
  return [...templateString.matchAll(matchExpr)].map((match) => ({
    token: match[0],
    fieldName: match.groups!.fieldName,
    fillChar: match.groups!.fillChar || ' ',
    alignment: match.groups!.alignment || '<',
    width: parseInt(match.groups!.width, 10),
  }));
}

/**
 * Process a template string based on the extracted tokens.
 */
export function processTemplateTokens(
  templateString: string,
  templateTokens: TemplateToken[],
  allFields: Field[],
  index: number
) {
  let resultString = templateString;
  templateTokens.forEach((templateToken) => {
    const { token, fieldName, fillChar, alignment, width } = templateToken;
    const matchingField = allFields.find((field) => field.name === fieldName);
    if (!matchingField) {
      return;
    }
    let replacementValue = matchingField.values[index]?.toString() ?? '';
    if (alignment === '<') {
      replacementValue = replacementValue.padEnd(width, fillChar || ' ');
    } else if (alignment === '>') {
      replacementValue = replacementValue.padStart(width, fillChar || ' ');
    } else if (alignment === '^') {
      const padding = Math.floor(Math.max(0, width - replacementValue.length) / 2);
      replacementValue = replacementValue
        .padStart(replacementValue.length + padding, fillChar || ' ')
        .padEnd(Number(width), fillChar || ' ');
    }
    resultString = resultString.replaceAll(token, replacementValue);
  });
  return resultString;
}
