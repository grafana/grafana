import React, { PureComponent } from 'react';
import Select from 'react-select';
import { UnitGroup } from './UnitGroup';
import UnitOption from './UnitOption';
import UnitMenu from './UnitMenu';
import ResetStyles from '../ResetStyles';
import kbn from '../../../utils/kbn';

interface Props {
  onSelected: (item: any) => {} | void;
}

export default class UnitPicker extends PureComponent<Props> {
  render() {
    const options = kbn.getUnitFormats();

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
          Menu: UnitMenu,
        }}
        styles={ResetStyles}
      />
    );
  }
}
