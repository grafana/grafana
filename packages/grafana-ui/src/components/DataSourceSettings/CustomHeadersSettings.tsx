import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import { PureComponent } from 'react';

import { DataSourceSettings } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { t, Trans } from '../../utils/i18n';
import { Button } from '../Button';
import { FormField } from '../FormField/FormField';
import { Icon } from '../Icon/Icon';
import { SecretFormField } from '../SecretFormField/SecretFormField';

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

const getCustomHeaderRowStyles = () => ({
  layout: css({
    display: 'flex',
    alignItems: 'center',
    marginBottom: '4px',
    '> *': {
      marginLeft: '4px',
      marginBottom: 0,
      height: '100%',
      '&:first-child, &:last-child': {
        marginLeft: 0,
      },
    },
  }),
});

const CustomHeaderRow = ({ header, onBlur, onChange, onRemove, onReset }: CustomHeaderRowProps) => {
  const styles = useStyles2(getCustomHeaderRowStyles);

  return (
    <div className={styles.layout}>
      <FormField
        label={t('grafana-ui.data-source-settings.custom-headers-header', 'Header')}
        name="name"
        // eslint-disable-next-line @grafana/no-untranslated-strings
        placeholder="X-Custom-Header"
        labelWidth={5}
        value={header.name || ''}
        onChange={(e) => onChange({ ...header, name: e.target.value })}
        onBlur={onBlur}
      />
      <SecretFormField
        label={t('grafana-ui.data-source-settings.custom-headers-header-value', 'Value')}
        aria-label={t('grafana-ui.data-source-settings.custom-headers-header-value', 'Value')}
        name="value"
        isConfigured={header.configured}
        value={header.value}
        labelWidth={5}
        inputWidth={header.configured ? 11 : 12}
        placeholder={t('grafana-ui.data-source-settings.custom-headers-header-placeholder', 'Header Value')}
        onReset={() => onReset(header.id)}
        onChange={(e) => onChange({ ...header, value: e.target.value })}
        onBlur={onBlur}
      />
      <Button
        type="button"
        aria-label={t('grafana-ui.data-source-settings.custom-headers-header-remove', 'Remove header')}
        variant="secondary"
        size="xs"
        onClick={(_e) => onRemove(header.id)}
      >
        <Icon name="trash-alt" />
      </Button>
    </div>
  );
};

CustomHeaderRow.displayName = 'CustomHeaderRow';

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
        .filter((key) => key.startsWith('httpHeaderName'))
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

    // we remove every httpHeaderName* field
    const newJsonData = Object.fromEntries(
      Object.entries(this.props.dataSourceConfig.jsonData).filter(([key, val]) => !key.startsWith('httpHeaderName'))
    );

    // we remove every httpHeaderValue* field
    const newSecureJsonData = Object.fromEntries(
      Object.entries(this.props.dataSourceConfig.secureJsonData || {}).filter(
        ([key, val]) => !key.startsWith('httpHeaderValue')
      )
    );

    // then we add the current httpHeader-fields
    for (const [index, header] of headers.entries()) {
      newJsonData[`httpHeaderName${index + 1}`] = header.name;
      if (!header.configured) {
        newSecureJsonData[`httpHeaderValue${index + 1}`] = header.value;
      }
    }

    this.props.onChange({
      ...this.props.dataSourceConfig,
      jsonData: newJsonData,
      secureJsonData: newSecureJsonData,
    });
  };

  onHeaderAdd = () => {
    this.setState((prevState) => {
      return { headers: [...prevState.headers, { id: uniqueId(), name: '', value: '', configured: false }] };
    });
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
        headers: headers.filter((h) => h.id !== headerId),
      }),
      this.updateSettings
    );
  };

  render() {
    const { headers } = this.state;
    const { dataSourceConfig } = this.props;

    return (
      <div className={'gf-form-group'}>
        <div className="gf-form">
          <h6>
            <Trans i18nKey="grafana-ui.data-source-settings.custom-headers-title">Custom HTTP Headers</Trans>
          </h6>
        </div>
        <div>
          {headers.map((header, i) => (
            <CustomHeaderRow
              key={header.id}
              header={header}
              onChange={(h) => {
                this.onHeaderChange(i, h);
              }}
              onBlur={this.updateSettings}
              onRemove={this.onHeaderRemove}
              onReset={this.onHeaderReset}
            />
          ))}
        </div>
        {!dataSourceConfig.readOnly && (
          <div className="gf-form">
            <Button
              variant="secondary"
              icon="plus"
              type="button"
              onClick={(e) => {
                this.onHeaderAdd();
              }}
            >
              <Trans i18nKey="grafana-ui.data-source-settings.custom-headers-add">Add header</Trans>
            </Button>
          </div>
        )}
      </div>
    );
  }
}

export default CustomHeadersSettings;
