import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import { memo, useState } from 'react';

import { DataSourceSettings } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { Icon } from '../Icon/Icon';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
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
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
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

export const CustomHeadersSettings = memo<Props>(({ dataSourceConfig, onChange }) => {
  const [headers, setHeaders] = useState<CustomHeaders>(() => {
    const { jsonData, secureJsonData, secureJsonFields } = dataSourceConfig;
    return Object.keys(jsonData)
      .sort()
      .filter((key) => key.startsWith('httpHeaderName'))
      .map((key, index) => {
        return {
          id: uniqueId(),
          name: jsonData[key],
          value: secureJsonData !== undefined ? secureJsonData[key] : '',
          configured: (secureJsonFields && secureJsonFields[`httpHeaderValue${index + 1}`]) || false,
        };
      });
  });

  const updateSettings = (newHeaders: CustomHeaders) => {
    // we remove every httpHeaderName* field
    const newJsonData = Object.fromEntries(
      Object.entries(dataSourceConfig.jsonData).filter(([key, val]) => !key.startsWith('httpHeaderName'))
    );

    // we remove every httpHeaderValue* field
    const newSecureJsonData = Object.fromEntries(
      Object.entries(dataSourceConfig.secureJsonData || {}).filter(([key, val]) => !key.startsWith('httpHeaderValue'))
    );

    // then we add the current httpHeader-fields
    for (const [index, header] of newHeaders.entries()) {
      newJsonData[`httpHeaderName${index + 1}`] = header.name;
      if (!header.configured) {
        newSecureJsonData[`httpHeaderValue${index + 1}`] = header.value;
      }
    }

    onChange({
      ...dataSourceConfig,
      jsonData: newJsonData,
      secureJsonData: newSecureJsonData,
    });
  };

  const onHeaderAdd = () => {
    setHeaders((prevHeaders) => [...prevHeaders, { id: uniqueId(), name: '', value: '', configured: false }]);
  };

  const onHeaderChange = (headerIndex: number, value: CustomHeader) => {
    setHeaders((prevHeaders) =>
      prevHeaders.map((item, index) => {
        if (headerIndex !== index) {
          return item;
        }
        return { ...value };
      })
    );
  };

  const onHeaderReset = (headerId: string) => {
    setHeaders((prevHeaders) =>
      prevHeaders.map((h) => {
        if (h.id !== headerId) {
          return h;
        }
        return {
          ...h,
          value: '',
          configured: false,
        };
      })
    );
  };

  const onHeaderRemove = (headerId: string) => {
    setHeaders((prevHeaders) => {
      const newHeaders = prevHeaders.filter((h) => h.id !== headerId);
      updateSettings(newHeaders);
      return newHeaders;
    });
  };

  return (
    <Box marginBottom={5}>
      <Box marginBottom={0.5} position="relative">
        <Stack direction="row" alignItems="baseline">
          <h6>
            <Trans i18nKey="grafana-ui.data-source-settings.custom-headers-title">Custom HTTP Headers</Trans>
          </h6>
        </Stack>
      </Box>
      <div>
        {headers.map((header, i) => (
          <CustomHeaderRow
            key={header.id}
            header={header}
            onChange={(h) => {
              onHeaderChange(i, h);
            }}
            onBlur={() => updateSettings(headers)}
            onRemove={onHeaderRemove}
            onReset={onHeaderReset}
          />
        ))}
      </div>
      {!dataSourceConfig.readOnly && (
        <Box marginBottom={0.5} position="relative">
          <Stack direction="row" alignItems="baseline">
            <Button
              variant="secondary"
              icon="plus"
              type="button"
              onClick={(e) => {
                onHeaderAdd();
              }}
            >
              <Trans i18nKey="grafana-ui.data-source-settings.custom-headers-add">Add header</Trans>
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
});

CustomHeadersSettings.displayName = 'CustomHeadersSettings';

export default CustomHeadersSettings;
