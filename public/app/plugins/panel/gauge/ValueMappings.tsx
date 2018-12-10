import React, { PureComponent } from 'react';
import MappingRow from './MappingRow';
import { OptionModuleProps } from './module';
import { MappingType, RangeMap, ValueMap } from 'app/types';

interface State {
  mappings: Array<ValueMap | RangeMap>;
}

export default class ValueMappings extends PureComponent<OptionModuleProps, State> {
  constructor(props) {
    super(props);

    this.state = {
      mappings: props.mappings || [],
    };
  }

  addMapping = () =>
    this.setState(prevState => ({
      mappings: [
        ...prevState.mappings,
        { op: '', value: '', text: '', type: MappingType.ValueToText, from: '', to: '' },
      ],
    }));

  onRemoveMapping = index =>
    this.setState(prevState => ({
      mappings: prevState.mappings.filter((m, i) => i !== index),
    }));

  updateGauge = mapping => {
    this.setState(
      prevState => ({
        mappings: prevState.mappings.map(m => {
          if (m === mapping) {
            return { ...mapping };
          }

          return m;
        }),
      }),
      () => {
        this.props.onChange({ ...this.props.options, mappings: this.state.mappings });
      }
    );
  };

  render() {
    const { mappings } = this.state;

    return (
      <div className="section gf-form-group">
        <h5 className="page-heading">Value mappings</h5>
        <div>
          {mappings.length > 0 &&
            mappings.map((mapping, index) => {
              return (
                <MappingRow
                  key={index}
                  mapping={mapping}
                  updateMapping={this.updateGauge}
                  removeMapping={() => this.onRemoveMapping(index)}
                />
              );
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
