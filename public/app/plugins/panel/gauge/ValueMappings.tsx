import React, { PureComponent } from 'react';
import MappingRow from './MappingRow';
import { OptionModuleProps } from './module';
import { RangeMap, ValueMap } from 'app/types';

interface State {
  combinedMappings: any[];
  valueMaps: ValueMap[];
  rangeMaps: RangeMap[];
}

export default class ValueMappings extends PureComponent<OptionModuleProps, State> {
  constructor(props) {
    super(props);

    this.state = {
      combinedMappings: props.options.valueMaps.concat(props.options.rangeMaps),
      rangeMaps: props.options.rangeMaps,
      valueMaps: props.options.valueMaps,
    };
  }

  addMapping = () =>
    this.setState(prevState => ({
      combinedMappings: [...prevState.combinedMappings, { op: '', value: '', text: '' }],
    }));

  updateGauge = mapping => {
    this.setState(prevState => ({
      combinedMappings: prevState.combinedMappings.map(m => {
        if (m === mapping) {
          return { ...mapping };
        }

        return m;
      }),
    }));
  };

  render() {
    const { combinedMappings } = this.state;

    return (
      <div className="section gf-form-group">
        <h5 className="page-heading">Value mappings</h5>
        <div>
          {combinedMappings.length > 0 &&
            combinedMappings.map((mapping, index) => {
              return <MappingRow key={index} mapping={mapping} updateMapping={this.updateGauge} />;
            })}
        </div>
        <div className="add-mapping-row" onClick={this.addMapping}>
          <div className="add-mapping-row-icon">
            <i className="fa fa-plus" />
          </div>
          <div className="add-mapping-row-label">Add mapping</div>
        </div>
      </div>
    );
  }
}
