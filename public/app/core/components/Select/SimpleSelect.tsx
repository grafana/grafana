import React from 'react';

export interface IProps {
  value: any;
  options: any[];
  className?: string;
  onChange: (value: any) => any;
}

export class SimpleSelect extends React.Component<IProps, any> {
  constructor(props) {
    super(props);

    this.onChange = this.onChange.bind(this);
  }

  onChange(e) {
    const newValue = e.target.value;
    this.props.onChange(newValue);
  }

  render() {
    const selectClassName = this.props.className;
    const value = this.props.value;

    const options = this.props.options;
    const optionsItems = options.map((option, index) => (
      <option value={option} key={index.toString()}>
        {option}
      </option>
    ));

    return (
      <select className={selectClassName} value={value} onChange={this.onChange}>
        {optionsItems}
      </select>
    );
  }
}
