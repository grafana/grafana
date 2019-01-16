import React, { PureComponent } from 'react';

import MappingRow from './MappingRow';
import { PanelOptionsProps, ValueMap, RangeMap, MappingType } from '../../types/panel';
import { GaugeOptions } from '../../types/gauge';
import { PanelOptionsGroup } from '../PanelOptionsGroup/PanelOptionsGroup';

interface State {
  mappings: Array<ValueMap | RangeMap>;
  nextIdToAdd: number;
}

export class ValueMappingsEditor extends PureComponent<PanelOptionsProps<GaugeOptions>, State> {
  constructor(props) {
    super(props);

    const mappings = props.options.mappings;

    this.state = {
      mappings: mappings || [],
      nextIdToAdd: mappings.length > 0 ? this.getMaxIdFromMappings(mappings) : 1,
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
      <PanelOptionsGroup title="Value Mappings">
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
      </PanelOptionsGroup>
    );
  }
}
