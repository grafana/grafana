import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import {
  Box,
  CollapsableSection,
  TextLink,
  Field,
  Input,
  Combobox,
  Space,
  Stack,
  Text,
  ComboboxOption,
  Alert,
} from '@grafana/ui';

import { InfluxOptions, InfluxVersion } from '../../../types';

import { AdvancedHttpSettings } from './AdvancedHttpSettings';
import { AuthSettings } from './AuthSettings';
import { CONFIG_SECTION_HEADERS } from './constants';
import {
  trackInfluxDBConfigV2ProductSelected,
  trackInfluxDBConfigV2QueryLanguageSelected,
  trackInfluxDBConfigV2URLInputField,
} from './tracking';
import { INFLUXDB_VERSION_MAP } from './versions';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

const getQueryLanguageOptions = (productName: string): Array<{ value: string }> => {
  const product = INFLUXDB_VERSION_MAP.find(({ name }) => name === productName);
  return product?.queryLanguages?.map(({ name }) => ({ value: name })) ?? [];
};

export const UrlAndAuthenticationSection = ({ options, onOptionsChange }: Props) => {
  const isInfluxVersion = (v: string): v is InfluxVersion =>
    typeof v === 'string' && (v === InfluxVersion.Flux || v === InfluxVersion.InfluxQL || v === InfluxVersion.SQL);

  // Database + Retention Policy (DBRP) mapping is required for InfluxDB OSS 1.x and 2.x when using InfluxQL
  const requiresDrbpMapping =
    (options.jsonData.product && options.jsonData.product === 'InfluxDB OSS 1.x') ||
    options.jsonData.product === 'InfluxDB OSS 2.x';

  const onProductChange = ({ value }: ComboboxOption) =>
    onOptionsChange({ ...options, jsonData: { ...options.jsonData, product: value, version: undefined } });

  const onQueryLanguageChange = ({ value }: ComboboxOption) => {
    if (isInfluxVersion(value)) {
      onOptionsChange({
        ...options,
        jsonData: { ...options.jsonData, version: value },
      });
    }
  };

  const onUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      url: event.currentTarget.value,
    });
  };

  return (
    <>
      <Box borderStyle="solid" borderColor="weak" padding={2} marginBottom={4} id={`${CONFIG_SECTION_HEADERS[0].id}`}>
        <CollapsableSection
          label={<Text element="h3">1. {CONFIG_SECTION_HEADERS[0].label}</Text>}
          isOpen={CONFIG_SECTION_HEADERS[0].isOpen}
        >
          <Text color="secondary">
            Enter the URL of your InfluxDB instance, then select your product and query language. This will determine
            the available settings and authentication methods in the next steps. If you are unsure what product you are
            using, view the{' '}
            <TextLink href="https://docs.influxdata.com/" external>
              InfluxDB Docs.
            </TextLink>
            .
          </Text>
          <Box direction="column" gap={2} marginTop={3}>
            <Field label={<div style={{ marginBottom: '5px' }}>URL</div>} noMargin>
              <Input
                placeholder="http://localhost:3000/"
                onChange={onUrlChange}
                value={options.url || ''}
                onBlur={trackInfluxDBConfigV2URLInputField}
              />
            </Field>
            <Box marginTop={2}>
              <Stack direction="row" gap={2}>
                <Box flex={1}>
                  <Field label={<div style={{ marginBottom: '5px' }}>Product</div>} noMargin>
                    <Combobox
                      value={options.jsonData.product}
                      options={INFLUXDB_VERSION_MAP.map(({ name }) => ({ value: name }))}
                      onChange={onProductChange}
                      onBlur={() => trackInfluxDBConfigV2ProductSelected({ product: options.jsonData.product! })}
                    />
                  </Field>
                </Box>
                <Box flex={1}>
                  <Field label={<div style={{ marginBottom: '5px' }}>Query language</div>} noMargin>
                    <Combobox
                      value={options.jsonData.product !== '' ? options.jsonData.version : ''}
                      options={getQueryLanguageOptions(options.jsonData.product || '')}
                      onChange={onQueryLanguageChange}
                      onBlur={() => trackInfluxDBConfigV2QueryLanguageSelected({ version: options.url })}
                    />
                  </Field>
                </Box>
              </Stack>
            </Box>
            <Space v={2} />
            {requiresDrbpMapping && (
              <Alert severity="warning" title="InfluxQL requires DRBP mapping">
                InfluxDB OSS 1.x and 2.x users must configure a Database + Retention Policy (DBRP) mapping via the CLI
                or API before data can be queried.{' '}
                <TextLink href="https://docs.influxdata.com/influxdb/cloud/query-data/influxql/dbrp/" external>
                  Learn how to set this up
                </TextLink>
              </Alert>
            )}
            <AdvancedHttpSettings options={options} onOptionsChange={onOptionsChange} />
            <AuthSettings options={options} onOptionsChange={onOptionsChange} />
          </Box>
        </CollapsableSection>
      </Box>
    </>
  );
};
