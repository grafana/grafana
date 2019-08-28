// Libraries
import React, { PureComponent, CSSProperties } from 'react';

// Types
import { DataFrame, KeyValue } from '@grafana/data';
import { TransformationConfig } from '../state/PanelModel';
import { Button } from '@grafana/ui';

// General interface?
interface Props {
  input: DataFrame[];
  config: TransformationConfig;
  onChange: (config: TransformationConfig) => void;
}

// Specific to this interface
interface FieldNameInfo {
  name: string;
  count: number;
}

interface State {
  options: FieldNameInfo[];
  selected: FieldNameInfo[];
}

export class ByNameTransform extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      options: [],
      selected: [],
    };
  }

  componentDidMount() {
    this.initOptions();
  }

  componentDidUpdate(prevProps: Props) {
    const { input, config } = this.props;
    if (input !== prevProps.input || config !== prevProps.config) {
      this.initOptions();
    }
  }

  private initOptions() {
    const { input, config } = this.props;

    const allNames: FieldNameInfo[] = [];
    const byName: KeyValue<FieldNameInfo> = {};
    for (const frame of input) {
      for (const field of frame.fields) {
        let v = byName[field.name];
        if (!v) {
          v = byName[field.name] = {
            name: field.name,
            count: 0,
          };
          allNames.push(v);
        }
        v.count++;
      }
    }

    if (config.args && config.args.length) {
      const options: FieldNameInfo[] = [];
      const selected: FieldNameInfo[] = [];
      for (const v of allNames) {
        if (config.args.includes(v.name)) {
          selected.push(v);
        } else {
          options.push(v);
        }
      }
      this.setState({ options, selected });
    } else {
      this.setState({ options: allNames, selected: [] });
    }
  }

  onAdd = (name: string) => {
    const { config, onChange } = this.props;
    const names = config.args || [];
    onChange({
      ...config,
      args: [...names, name], // does not make sure it is unique
    });
  };

  onRemove = (name: string) => {
    const { config, onChange } = this.props;
    const names = config.args || [];
    onChange({
      ...config,
      args: names.filter(n => n === name),
    });
  };

  renderField(field: FieldNameInfo, used: boolean) {
    const style: CSSProperties = { border: '1px solid #CCC', padding: '8px', marginBottom: '8px' };
    return (
      <div key={field.name} style={style}>
        {field.name}
        {field.count > 1 && <span>x{field.count}</span>}
        <Button
          onClick={() => {
            if (used) {
              this.onRemove(field.name);
            } else {
              this.onAdd(field.name);
            }
          }}
        >
          {used ? 'Remove' : 'Add'}
        </Button>
      </div>
    );
  }

  render() {
    const { options, selected } = this.state;
    // This should obviously be somethign different than a table!!!
    const style: CSSProperties = { verticalAlign: 'top', width: '50%' };
    return (
      <div>
        <table>
          <tbody>
            <tr>
              <td style={style}>
                <b>RESPONSE:</b>
                {options.map(field => {
                  return this.renderField(field, false);
                })}
              </td>
              <td style={style}>
                <b>SHOW:</b>
                {selected.map(field => {
                  return this.renderField(field, true);
                })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}
