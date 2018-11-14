import React, { PureComponent } from 'react';
import Select from 'react-select';
import ResetStyles from 'app/core/components/Picker/ResetStyles';
import DescriptionOption from './DescriptionOption';
import kbn from '../../utils/kbn';

interface Props {
  width: number;
  className?: string;
  onSelected: (item: any) => {} | void;
  placeholder?: string;
}

export class UnitPicker extends PureComponent<Props> {
  formatGroupLabel = data => {
    console.log('format', data);

    const groupStyles = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    };

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
        <span style={groupBadgeStyles}>{data.submenu.length}</span>
      </div>
    );
  };

  render() {
    const { className, onSelected, placeholder, width } = this.props;

    const options = kbn.getUnitFormats();

    return (
      <Select
        classNamePrefix="gf-form-select-box"
        className={`width-${width} gf-form-input gf-form-input--form-dropdown ${className || ''}`}
        components={{
          Option: DescriptionOption,
        }}
        getOptionLabel={i => i.text}
        getOptionValue={i => i.value}
        isSearchable={false}
        onChange={onSelected}
        options={options}
        placeholder={placeholder || 'Choose'}
        styles={ResetStyles}
        formatGroupLabel={this.formatGroupLabel}
      />
    );
  }
}
