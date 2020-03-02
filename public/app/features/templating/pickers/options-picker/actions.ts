import { ThunkResult } from 'app/types';
import { VariableOption, VariableWithMultiSupport, VariableWithOptions } from '../../variable';
import { variableAdapters } from '../../adapters';
import { getVariable } from '../../state/selectors';
import { VariableOptionsPickerState, hideVariableDropDown, changeQueryVariableSearchQuery } from './reducer';

export const filterOptions = (searchQuery: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { uuid } = getState().optionsPicker;
    const { options, query } = getVariable<VariableWithMultiSupport>(uuid, getState());
    dispatch(changeQueryVariableSearchQuery({ searchQuery, query, options }));
  };
};

export const commitChangesToVariable = (): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const picker = getState().optionsPicker;
    const variable = getVariable<VariableWithMultiSupport>(picker.uuid, getState());

    // TODO: dispatch action and move this to variable reducer
    const current = mapToCurrent(picker);
    const nextVariable = { current, options: picker.options } as VariableWithOptions;

    if (getLinkText(nextVariable) === variable.current.text) {
      return dispatch(hideVariableDropDown());
    }

    const adapter = variableAdapters.get(variable.type);
    await adapter.setValue(variable, current, true);
    return dispatch(hideVariableDropDown());
  };
};

function mapToCurrent(picker: VariableOptionsPickerState): VariableOption {
  const { options, searchQuery, multi } = picker;

  if (options.length === 0 && searchQuery && searchQuery.length > 0) {
    return { text: searchQuery, value: searchQuery, selected: false };
  }

  if (!multi) {
    return options.find(o => o.selected);
  }

  const texts: string[] = [];
  const values: string[] = [];

  for (const option of options) {
    if (!option.selected) {
      continue;
    }

    texts.push(option.text.toString());
    values.push(option.value.toString());
  }

  return {
    value: values,
    text: texts.join(' + '),
    tags: picker.tags,
    selected: true,
  };
}

const getLinkText = (variable: VariableWithOptions) => {
  const { current, options } = variable;

  if (!current.tags || current.tags.length === 0) {
    if (typeof current.text === 'string') {
      return current.text;
    }
    return current.text.join(' + ');
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
