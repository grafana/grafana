import React, { PureComponent } from 'react';
import Select from 'react-select';
import UnitGroup from './UnitGroup';
import UnitOption from './UnitOption';
import ResetStyles from '../ResetStyles';
import kbn from '../../../utils/kbn';

interface Props {
  onSelected: (item: any) => {} | void;
  defaultValue?: string;
  width?: number;
}

export default class UnitPicker extends PureComponent<Props> {
  static defaultProps = {
    width: 12,
  };

  render() {
    const { defaultValue, onSelected, width } = this.props;

    const unitGroups = kbn.getUnitFormats();

    // Need to transform the data structure to work well with Select
    const groupOptions = unitGroups.map(group => {
      const options = group.submenu.map(unit => {
        return {
          label: unit.text,
          value: unit.value,
        };
      });

      return {
        label: group.text,
        options,
      };
    });

    const styles = {
      ...ResetStyles,
      menu: () => ({
        maxHeight: '75%',
        overflow: 'scroll',
      }),
      menuList: () =>
        ({
          overflowY: 'auto',
          position: 'relative',
        } as React.CSSProperties),
      valueContainer: () =>
        ({
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '90px',
          whiteSpace: 'nowrap',
        } as React.CSSProperties),
    };

    const value = groupOptions.map(group => {
      return group.options.find(option => option.value === defaultValue);
    });

    return (
      <Select
        classNamePrefix="gf-form-select-box"
        className={`width-${width} gf-form-input gf-form-input--form-dropdown`}
        defaultValue={value}
        isSearchable={true}
        menuShouldScrollIntoView={false}
        options={groupOptions}
        placeholder="Choose"
        onChange={onSelected}
        components={{
          Group: UnitGroup,
          Option: UnitOption,
        }}
        styles={styles}
      />
    );
  }
}
