import React, { PureComponent, ReactElement } from 'react';

interface ToggleButtonGroupProps {
  onChange: (value) => void;
  value?: any;
  label?: string;
}

export default class ToggleButtonGroup extends PureComponent<ToggleButtonGroupProps> {
  getValues() {
    const { children } = this.props;
    return React.Children.toArray(children).map(c => c['props'].value);
  }

  handleToggle(toggleValue) {
    const { value, onChange } = this.props;
    if (value && value === toggleValue) {
      return;
    }
    onChange(toggleValue);
  }

  render() {
    const { children, value, label } = this.props;
    const values = this.getValues();
    const selectedValue = value || values[0];

    const childClones = React.Children.map(children, (child: ReactElement<any>) => {
      const { value: buttonValue } = child.props;

      return React.cloneElement(child, {
        selected: buttonValue === selectedValue,
        onChange: this.handleToggle.bind(this),
      });
    });

    return (
      <div className="gf-form">
        <div className="toggle-button-group">
          {label && <label className="gf-form-label">{label}</label>}
          {childClones}
        </div>
      </div>
    );
  }
}
