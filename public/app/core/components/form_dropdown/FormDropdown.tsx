import React from 'react';
// import ReactDOM from 'react-dom';
import Select from 'react-select';
import $ from 'jquery';
import 'react-select/scss/default.scss';
import { react2AngularDirective } from 'app/core/utils/react2angular';

interface IOptionsItem {
  value: string;
  label: string;
}

interface IProps {
  value: string;
  options: IOptionsItem[];
  cssClass: any;
  labelMode: boolean;
  getOptions: (input: string) => any;
  onChange: (val: any) => void;
}

export class FormDropdown extends React.Component<IProps, any> {
  selectControl: any;

  constructor(props) {
    super(props);
    this.state = {
      labelMode: this.props.labelMode,
      cssClasses: ""
    };

    this.loadOptionsInternal = this.loadOptionsInternal.bind(this);
    this.onChangeInternal = this.onChangeInternal.bind(this);
    this.onOpen = this.onOpen.bind(this);
    this.onClose = this.onClose.bind(this);
    this.setSelectElement = this.setSelectElement.bind(this);
  }

  loadOptionsInternal(input: string, callback: (err, data) => any) {
    return this.props.getOptions(input).then((options) => {
      console.log('loadOptionsInternal', options);
      return {
        options: options
      };
    });
  }

  onChangeInternal(newValue) {
    console.log('onChangeInternal', newValue);
    this.props.onChange(newValue);
  }

  setSelectElement(component) {
    if (component) {
      this.selectControl = $(component.select.control);
    } else {
      return null;
    }
  }

  getValueLabel() {
    return this.selectControl.find('.Select-value-label');
  }

  onOpen() {
    // Clear label
    this.getValueLabel().text("");
  }

  onClose() {
    // Set cleared label back to value
    this.getValueLabel().text(this.props.value);
  }

  render() {
    if (this.state.labelMode) {
      this.state.cssClasses = "gf-form-label gf-form-dropdown-react " + this.props.cssClass;
    } else {
      this.state.cssClasses = "gf-form-input gf-form-dropdown-react " + this.props.cssClass;
    }

    const formDropdown = (
      <Select name="form-field-name"
        value={this.props.value}
        options={this.props.options}
        onChange={this.onChangeInternal}
        onOpen={this.onOpen}
        onClose={this.onClose}
        clearable={false}
        labelKey="text"
      />
    );

    const formDropdownAsync = (
      <Select.Async name="form-field-name" ref={this.setSelectElement}
        value={this.props.value}
        loadOptions={this.loadOptionsInternal}
        onChange={this.onChangeInternal}
        onOpen={this.onOpen}
        onClose={this.onClose}
        clearable={false}
        labelKey="text"
        placeholder="default"
        closeOnSelect={false}
      />
    );

    console.log('render', this.props.value);
    return (
      <div className={this.state.cssClasses}>
        {this.props.getOptions ? formDropdownAsync : formDropdown}
      </div>
    );
  }
}

react2AngularDirective('gfFormDropdownReact', FormDropdown, [
  'value',
  'options',
  'cssClass',
  'labelMode',
  ['getOptions', { watchDepth: 'reference', wrapApply: true }],
  ['onChange', { watchDepth: 'reference', wrapApply: true }],
]);
