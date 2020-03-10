import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { StoreState } from 'app/types';
import { ClickOutsideWrapper } from '@grafana/ui';
import { VariableLink } from '../shared/VariableLink';
import { VariableInput } from '../shared/VariableInput';
import { commitChangesToVariable, filterOrSearchOptions, navigateOptions, toggleAndFetchTag } from './actions';
import { OptionsPickerState, showOptions, toggleAllOptions, toggleOption } from './reducer';
import { VariableOption, VariableTag, VariableWithMultiSupport, VariableWithOptions } from '../../variable';
import { VariableOptions } from '../shared/VariableOptions';
import { isQuery } from '../../guard';
import { VariablePickerProps } from '../types';

interface OwnProps extends VariablePickerProps<VariableWithMultiSupport> {}

interface ConnectedProps {
  picker: OptionsPickerState;
}

interface DispatchProps {
  showOptions: typeof showOptions;
  commitChangesToVariable: typeof commitChangesToVariable;
  toggleAllOptions: typeof toggleAllOptions;
  toggleOption: typeof toggleOption;
  toggleAndFetchTag: typeof toggleAndFetchTag;
  filterOrSearchOptions: typeof filterOrSearchOptions;
  navigateOptions: typeof navigateOptions;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export class OptionsPickerUnconnected extends PureComponent<Props> {
  onShowOptions = () => this.props.showOptions(this.props.variable);
  onHideOptions = () => this.props.commitChangesToVariable();

  onToggleOption = (option: VariableOption, clearOthers: boolean) => {
    this.props.toggleOption({
      option,
      clearOthers,
      forceSelect: false,
    });
  };

  render() {
    const { variable, picker } = this.props;
    const showOptions = picker.uuid === variable.uuid;

    return (
      <div className="variable-link-wrapper">
        {this.renderLink(showOptions, variable)}
        {this.renderOptions(showOptions, picker)}
      </div>
    );
  }

  renderLink(showOptions: boolean, variable: VariableWithMultiSupport) {
    if (showOptions) {
      return null;
    }

    const linkText = getLinkText(variable);
    const tags = getSelectedTags(variable);

    return <VariableLink text={linkText} tags={tags} onClick={this.onShowOptions} />;
  }

  renderOptions(showOptions: boolean, picker: OptionsPickerState) {
    if (!showOptions) {
      return null;
    }

    return (
      <ClickOutsideWrapper onClick={this.onHideOptions}>
        <VariableInput
          value={picker.queryValue}
          onChange={this.props.filterOrSearchOptions}
          onNavigate={this.props.navigateOptions}
        />
        <VariableOptions
          values={picker.options}
          onToggle={this.onToggleOption}
          onToggleAll={this.props.toggleAllOptions}
          onToggleTag={this.props.toggleAndFetchTag}
          highlightIndex={picker.highlightIndex}
          multi={picker.multi}
          tags={picker.tags}
          selectedValues={picker.selectedValues}
        />
      </ClickOutsideWrapper>
    );
  }
}

const getSelectedTags = (variable: VariableWithOptions): VariableTag[] => {
  if (!isQuery(variable) || !Array.isArray(variable.tags)) {
    return [];
  }
  return variable.tags.filter(t => t.selected);
};

const getLinkText = (variable: VariableWithOptions) => {
  const { current, options } = variable;

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

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  showOptions,
  commitChangesToVariable,
  filterOrSearchOptions,
  toggleAllOptions,
  toggleOption,
  toggleAndFetchTag,
  navigateOptions,
};

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => ({
  picker: state.templating.optionsPicker,
});

export const OptionsPicker = connect(mapStateToProps, mapDispatchToProps)(OptionsPickerUnconnected);
OptionsPicker.displayName = 'OptionsPicker';
