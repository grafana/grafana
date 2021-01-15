import { VariableModel } from '@grafana/data';
import { VariableWithOptions } from '../types';

export const formatVariableLabel = (variable: VariableModel) => {
  if (!isVariableWithOptions(variable)) {
    return variable.name;
  }

  const { current, options = [] } = variable;

  if (!current.tags || current.tags.length === 0) {
    if (Array.isArray(current.text)) {
      return current.text.join(' + ');
    }
    return current.text;
  }

  // filer out values that are in selected tags
  const selectedAndNotInTag = options.filter(option => {
    if (!option.selected) {
      return false;
    }

    if (!current || !current.tags || !current.tags.length) {
      return false;
    }

    for (let i = 0; i < current.tags.length; i++) {
      const tag = current.tags[i];
      const foundIndex = tag?.values?.findIndex(v => v === option.value);
      if (foundIndex && foundIndex !== -1) {
        return false;
      }
    }
    return true;
  });

  // convert values to text
  const currentTexts = selectedAndNotInTag.map(s => s.text);

  // join texts
  const newLinkText = currentTexts.join(' + ');
  return newLinkText.length > 0 ? `${newLinkText} + ` : newLinkText;
};

const isVariableWithOptions = (variable: VariableModel): variable is VariableWithOptions => {
  return (
    Array.isArray((variable as VariableWithOptions)?.options) ||
    typeof (variable as VariableWithOptions)?.current === 'object'
  );
};
