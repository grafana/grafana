import React, { PureComponent } from 'react';
import Select from 'react-select';
import UnitGroup from './UnitGroup';
import UnitOption from './UnitOption';
import ResetStyles from '../ResetStyles';
import kbn from '../../../utils/kbn';

interface Props {
  onSelected: (item: any) => {} | void;
}

export default class UnitPicker extends PureComponent<Props> {
  render() {
    const unitGroups = kbn.getUnitFormats();
    const options = unitGroups.map(group => {
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
        maxHeight: '500px',
        overflow: 'scroll',
      }),
      menuList: () =>
        ({
          WebkitOverflowScrolling: 'touch',
          overflowY: 'auto',
          position: 'relative',
        } as React.CSSProperties),
    };

    return (
      <Select
        classNamePrefix="gf-form-select-box"
        className="width-20 gf-form-input"
        isSearchable={true}
        options={options}
        placeholder="Choose"
        components={{
          Group: UnitGroup,
          Option: UnitOption,
        }}
        styles={styles}
      />
    );
  }
}
