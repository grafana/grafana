import React, { PureComponent } from 'react';
import MappingRow from './MappingRow';
import { OptionModuleProps } from './module';
import { MappingType, RangeMap, ValueMap } from 'app/types';

interface State {
  mappings: Array<ValueMap | RangeMap>;
  nextIdToAdd: number;
}

export default class ValueMappings extends PureComponent<OptionModuleProps, State> {
  constructor(props) {
    super(props);

    const mappings = props.options.mappings;

    this.state = {
      mappings: mappings || [],
      nextIdToAdd: mappings ? this.getMaxIdFromMappings(mappings) : 1,
    };
  }

  getMaxIdFromMappings(mappings) {
    return Math.max.apply(null, mappings.map(mapping => mapping.id).map(m => m)) + 1;
  }

  addMapping = () =>
    this.setState(prevState => ({
      mappings: [
        ...prevState.mappings,
        {
          id: prevState.nextIdToAdd,
          operator: '',
          value: '',
          text: '',
          type: MappingType.ValueToText,
          from: '',
          to: '',
        },
      ],
      nextIdToAdd: prevState.nextIdToAdd + 1,
    }));

  onRemoveMapping = id => {
    this.setState(
      prevState => ({
        mappings: prevState.mappings.filter(m => {
          return m.id !== id;
        }),
      }),
      () => {
        this.props.onChange({ ...this.props.options, mappings: this.state.mappings });
      }
    );
  };

  updateGauge = mapping => {
    this.setState(
      prevState => ({
        mappings: prevState.mappings.map(m => {
          if (m.id === mapping.id) {
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
            mappings.map((mapping, index) => (
              <MappingRow
                key={`${mapping.text}-${index}`}
                mapping={mapping}
                updateMapping={this.updateGauge}
                removeMapping={() => this.onRemoveMapping(mapping.id)}
              />
            ))}
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
