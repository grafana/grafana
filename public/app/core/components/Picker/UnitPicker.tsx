import React, { PureComponent } from 'react';
import Select, { components } from 'react-select';
import ResetStyles from 'app/core/components/Picker/ResetStyles';
import kbn from '../../utils/kbn';

interface Props {
  onSelected: (item: any) => {} | void;
}

export class UnitPicker extends PureComponent<Props> {
  formatGroupLabel = data => {
    const groupStyles = {
      margin: '0 15px',
      fontSize: '16px',
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    } as React.CSSProperties;

    const groupBadgeStyles = {
      backgroundColor: '#EBECF0',
      borderRadius: '2em',
      color: '#172B4D',
      display: 'inline-block',
      fontSize: 12,
      fontWeight: 400,
      lineHeight: '1',
      minWidth: 1,
      padding: '0.16666666666667em 0.5em',
      textAlign: 'center',
    } as React.CSSProperties;

    return (
      <div style={groupStyles}>
        <span>{data.label}</span>
        <span style={groupBadgeStyles}>{data.options.length}</span>
      </div>
    );
  };

  renderOption = props => {
    return (
      <components.Option {...props}>
        <div className="description-picker-option__button btn btn-link">
          <div className="gf-form">{props.children}</div>
        </div>
      </components.Option>
    );
  };

  renderGroup = props => {
    return <components.Group {...props} />;
  };

  render() {
    const options = kbn.getUnitFormats();

    return (
      <Select
        classNamePrefix="gf-form-select-box"
        className="width-20 gf-form-input"
        isSearchable={false}
        options={options}
        placeholder="Choose"
        components={{
          Option: this.renderOption,
          Group: this.renderGroup,
        }}
        styles={ResetStyles}
        formatGroupLabel={this.formatGroupLabel}
      />
    );
  }
}
