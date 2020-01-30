import React, { PureComponent } from 'react';
import { DataSourceSettings } from '@grafana/data';
import uniqueId from 'lodash/uniqueId';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { SecretFormField } from '../SecretFormFied/SecretFormField';

export interface CustomHeader {
  id: string;
  name: string;
  value: string;
  configured: boolean;
}

export type CustomHeaders = CustomHeader[];

export interface Props {
  dataSourceConfig: DataSourceSettings<any, any>;
  onChange: (config: DataSourceSettings) => void;
}

export interface State {
  headers: CustomHeaders;
}

interface CustomHeaderRowProps {
  header: CustomHeader;
  onReset: (id: string) => void;
  onRemove: (id: string) => void;
  onChange: (value: CustomHeader) => void;
  onBlur: () => void;
}

const CustomHeaderRow: React.FC<CustomHeaderRowProps> = ({ header, onBlur, onChange, onRemove, onReset }) => {
  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <FormField
          label="Header"
          name="name"
          placeholder="X-Custom-Header"
          labelWidth={5}
          value={header.name || ''}
          onChange={e => onChange({ ...header, name: e.target.value })}
          onBlur={onBlur}
        />
      </div>
      <div className="gf-form">
        <SecretFormField
          label="Value"
          name="value"
          isConfigured={header.configured}
          value={header.value}
          labelWidth={5}
          inputWidth={header.configured ? 11 : 12}
          placeholder="Header Value"
          onReset={() => onReset(header.id)}
          onChange={e => onChange({ ...header, value: e.target.value })}
          onBlur={onBlur}
        />
      </div>
      <div className="gf-form">
        <Button variant="danger" size="xs" onClick={_e => onRemove(header.id)}>
          <i className="fa fa-remove" />
        </Button>
      </div>
    </div>
  );
};

export class CustomHeadersSettings extends PureComponent<Props, State> {
  state: State = {
    headers: [],
  };

  constructor(props: Props) {
    super(props);
    const { jsonData, secureJsonData, secureJsonFields } = this.props.dataSourceConfig;
    this.state = {
      headers: Object.keys(jsonData)
        .sort()
        .filter(key => key.startsWith('httpHeaderName'))
        .map((key, index) => {
          return {
            id: uniqueId(),
            name: jsonData[key],
            value: secureJsonData !== undefined ? secureJsonData[key] : '',
            configured: (secureJsonFields && secureJsonFields[`httpHeaderValue${index + 1}`]) || false,
          };
        }),
    };
  }

  updateSettings = () => {
    const { headers } = this.state;
    const { jsonData } = this.props.dataSourceConfig;
    const secureJsonData = this.props.dataSourceConfig.secureJsonData || {};
    for (const [index, header] of headers.entries()) {
      jsonData[`httpHeaderName${index + 1}`] = header.name;
      if (!header.configured) {
        secureJsonData[`httpHeaderValue${index + 1}`] = header.value;
      }
      Object.keys(jsonData)
        .filter(
          key =>
            key.startsWith('httpHeaderName') && parseInt(key.substring('httpHeaderName'.length), 10) > headers.length
        )
        .forEach(key => {
          delete jsonData[key];
        });
    }

    this.props.onChange({
      ...this.props.dataSourceConfig,
      jsonData,
      secureJsonData,
    });
  };

  onHeaderAdd = () => {
    this.setState(prevState => {
      return { headers: [...prevState.headers, { id: uniqueId(), name: '', value: '', configured: false }] };
    }, this.updateSettings);
  };

  onHeaderChange = (headerIndex: number, value: CustomHeader) => {
    this.setState(({ headers }) => {
      return {
        headers: headers.map((item, index) => {
          if (headerIndex !== index) {
            return item;
          }
          return { ...value };
        }),
      };
    });
  };

  onHeaderReset = (headerId: string) => {
    this.setState(({ headers }) => {
      return {
        headers: headers.map((h, i) => {
          if (h.id !== headerId) {
            return h;
          }
          return {
            ...h,
            value: '',
            configured: false,
          };
        }),
      };
    });
  };

  onHeaderRemove = (headerId: string) => {
    this.setState(
      ({ headers }) => ({
        headers: headers.filter(h => h.id !== headerId),
      }),
      this.updateSettings
    );
  };

  render() {
    const { headers } = this.state;
    return (
      <div className={'gf-form-group'}>
        <div className="gf-form">
          <h6>Custom HTTP Headers</h6>
        </div>
        <div>
          {headers.map((header, i) => (
            <CustomHeaderRow
              key={header.id}
              header={header}
              onChange={h => {
                this.onHeaderChange(i, h);
              }}
              onBlur={this.updateSettings}
              onRemove={this.onHeaderRemove}
              onReset={this.onHeaderReset}
            />
          ))}
        </div>
        <div className="gf-form">
          <Button
            variant="inverse"
            size="xs"
            onClick={e => {
              this.onHeaderAdd();
            }}
          >
            Add Header
          </Button>
        </div>
      </div>
    );
  }
}

export default CustomHeadersSettings;
