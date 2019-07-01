import React, { PureComponent } from 'react';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { SecretFormField } from '../SecretFormFied/SecretFormField';
import { DataSourceSettings } from '@grafana/data';

export interface CustomHeader {
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

export class CustomHeadersSettings extends PureComponent<Props, State> {
  state: State = {
    headers: [],
  };

  constructor(props: Props) {
    super(props);
  }

  componentDidMount(): void {
    this.updateHeaders();
  }

  updateSettings(headers: CustomHeaders) {
    const { jsonData, secureJsonData } = this.props.dataSourceConfig;

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
  }

  onHeaderAdd() {
    this.setState(
      prevState => {
        return { headers: [...prevState.headers, { name: 'X-Custom-Header', value: '', configured: false }] };
      },
      () => this.updateSettings(this.state.headers)
    );
  }

  onHeaderChange(headerIndex: number, key: string, value: string) {
    this.setState(prevState => {
      return {
        headers: prevState.headers.map((item, index) => {
          if (headerIndex !== index) {
            return item;
          }
          return {
            ...item,
            [key]: value,
          };
        }),
      };
    });
  }

  onHeaderReset(headerIndex: number) {
    this.setState(prevState => {
      return {
        headers: prevState.headers.map((item, index) => {
          if (headerIndex !== index) {
            return item;
          }
          return {
            ...item,
            value: '',
            configured: false,
          };
        }),
      };
    });
  }

  onHeaderRemove(headerIndex: number) {
    this.setState(
      prevState => {
        return {
          headers: [...prevState.headers.slice(0, headerIndex), ...prevState.headers.slice(headerIndex + 1)],
        };
      },
      () => this.updateSettings(this.state.headers)
    );
  }

  updateHeaders() {
    const { jsonData, secureJsonData, secureJsonFields } = this.props.dataSourceConfig;
    this.setState({
      headers: Object.keys(jsonData)
        .sort()
        .filter(key => key.startsWith('httpHeaderName'))
        .map((key, index) => {
          return {
            name: jsonData[key],
            value: secureJsonData !== undefined ? secureJsonData[key] : '',
            configured: (secureJsonFields && secureJsonFields[`httpHeaderValue${index + 1}`]) || false,
          };
        }),
    });
  }

  render() {
    const { headers } = this.state;

    return (
      <div className={'gf-form-group'}>
        <div className="gf-form">
          <h6>Custom HTTP Headers</h6>
        </div>
        <div>
          {headers.map((header, index) => (
            <div key={index} className="gf-form-inline">
              <div className="gf-form">
                <FormField
                  label="Header"
                  name="name"
                  defaultValue={header.name}
                  labelWidth={5}
                  onChange={e => this.onHeaderChange(index, 'name', e.target.value)}
                  onBlur={_ => this.updateSettings(this.state.headers)}
                />
              </div>
              <div className="gf-form">
                <SecretFormField
                  label={'Value'}
                  name={'value'}
                  isConfigured={header.configured}
                  value={header.value}
                  labelWidth={5}
                  inputWidth={header.configured ? 11 : 12}
                  placeholder={'Header Value'}
                  onReset={_ => this.onHeaderReset(index)}
                  onChange={e => this.onHeaderChange(index, 'value', e.target.value)}
                  onBlur={_ => this.updateSettings(this.state.headers)}
                />
              </div>
              <div className="gf-form">
                <Button
                  variant="danger"
                  size="xs"
                  onClick={e => {
                    e.preventDefault();
                    this.onHeaderRemove(index);
                  }}
                >
                  <i className="fa fa-remove" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="gf-form">
          <Button
            variant="inverse"
            size="xs"
            onClick={e => {
              e.preventDefault();
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
