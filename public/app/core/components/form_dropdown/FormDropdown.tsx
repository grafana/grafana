import React from 'react';
// import ReactDOM from 'react-dom';
import Select from 'react-select';
import { AsyncCreatable } from 'react-select';
import _ from 'lodash';
import $ from 'jquery';
import 'react-select/scss/default.scss';
import { react2AngularDirective } from 'app/core/utils/react2angular';

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
    this.onOpen = this.onOpen.bind(this);
    this.onClose = this.onClose.bind(this);
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

  getValueLabel() {
    return this.selectControl.find('.Select-value-label');
  }

  onOpen() {
    // Clear input label
    this.getValueLabel().text("");
  }

  onClose() {
    // Set cleared input label back to current value
    this.getValueLabel().text(this.state.value.value);
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
      onOpen: this.onOpen,
      onClose: this.onClose,
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

react2AngularDirective('gfFormDropdownReact', FormDropdown, [
  'value',
  'options',
  'cssClass',
  'labelMode',
  'allowCustom',
  'lookupText',
  'cache',
  ['getOptions', { watchDepth: 'reference', wrapApply: true }],
  ['onChange', { watchDepth: 'reference', wrapApply: true }],
]);
