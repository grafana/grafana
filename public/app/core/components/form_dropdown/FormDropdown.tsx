import React from 'react';
import Select from 'react-select';
import { AsyncCreatable } from 'react-select';
import _ from 'lodash';
import $ from 'jquery';

const NULL_VALUE_PLACEHOLDER = 'default';
const LABEL_KEY = 'text';
const VALUE_KEY = 'value';

interface IOptionsItem {
  value: string;
  text: string;
}

interface IProps {
  value: string;
  options: IOptionsItem[];
  cssClass: any;
  labelMode: boolean;
  allowCustom: boolean;
  lookupText: boolean;
  cache: boolean;
  getOptions: (input: string) => any;
  onChange: (val: any) => void;
}

export class FormDropdown extends React.Component<IProps, any> {
  selectControl: any;
  selectComponent: any;
  text: string;
  optionsCache: any;

  constructor(props) {
    super(props);
    this.state = {
      value: convertToOption(this.props.value),
      cssClasses: ""
    };
    this.optionsCache = {};

    this.loadOptionsInternal = this.loadOptionsInternal.bind(this);
    this.onChangeInternal = this.onChangeInternal.bind(this);
    this.setSelectElement = this.setSelectElement.bind(this);
    this.valueRenderer = this.valueRenderer.bind(this);
  }

  loadOptionsInternal(input: string) {
    return this.props.getOptions(input)
    .then((options) => {
      return {
        options: options
      };
    });
  }

  onChangeInternal(newValue) {
    this.setState({value: newValue});
    this.props.onChange(newValue);
  }

  setSelectElement(component) {
    if (component) {
      this.selectComponent = component.select;
      this.selectControl = $(component.select.control);
    } else {
      return null;
    }
  }

  // Set label text for custom values instead of 'Create option "{label}"'
  promptTextCreator(filterText: string): string {
    return filterText;
  }

  // Fix issue 2125: if no items match entered text, value is selected only after second click/Enter press.
  // https://github.com/JedWatson/react-select/issues/2125
  isOptionUnique({ option, options, labelKey, valueKey }): boolean {
    let values = _.map(options, valueKey);
    let optionIndex = _.lastIndexOf(values, option[valueKey]);
    let result = (values.length === 1 && optionIndex >= 0) || !(optionIndex > 0);
    return result;
  }

  valueRenderer(option) {
    if (this.props.lookupText) {
      return option[LABEL_KEY];
    } else {
      return option[VALUE_KEY];
    }
  }

  render() {
    let cssClasses;
    if (this.props.labelMode) {
      cssClasses = "gf-form-label gf-form-dropdown-react " + this.props.cssClass;
    } else {
      cssClasses = "gf-form-input gf-form-dropdown-react " + this.props.cssClass;
    }

    const commonProps = {
      value: this.state.value,
      cache: this.props.cache !== false ? this.optionsCache : false, // enabled by default
      name: "form-field-name",
      clearable: false,
      labelKey: LABEL_KEY,
      valueKey: VALUE_KEY,
      placeholder: NULL_VALUE_PLACEHOLDER,
      onChange: this.onChangeInternal,
      ref: this.setSelectElement,
      valueRenderer: this.valueRenderer
    };

    const formDropdown = (
      <Select {...commonProps}
        options={this.props.options}
      />
    );

    const formDropdownAsync = (
      <Select.Async {...commonProps}
        loadOptions={this.loadOptionsInternal}
      />
    );

    const formDropdownAsyncCreatable = (
      <AsyncCreatable {...commonProps}
        loadOptions={this.loadOptionsInternal}
        promptTextCreator={this.promptTextCreator}
        isOptionUnique={this.isOptionUnique}
      />
    );

    let formDropdownComponent;
    if (this.props.getOptions) {
      if (this.props.allowCustom) {
        formDropdownComponent = formDropdownAsyncCreatable;
      } else {
        formDropdownComponent = formDropdownAsync;
      }
    } else {
      formDropdownComponent = formDropdown;
    }

    return (
      <div className={cssClasses}>
        {formDropdownComponent}
      </div>
    );
  }
}

function convertToOption(value) {
  let option = {
    value: value
  };
  option[LABEL_KEY] = value;
  return option;
}
