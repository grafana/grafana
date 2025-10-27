import { css } from '@emotion/css';
import { firstValueFrom } from 'rxjs';

import { onUpdateDatasourceJsonDataOptionSelect, onUpdateDatasourceOption } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
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
  useStyles2,
} from '@grafana/ui';

import { InfluxVersion } from '../../../types';

import { AdvancedHttpSettings } from './AdvancedHttpSettings';
import { AuthSettings } from './AuthSettings';
import { CONFIG_SECTION_HEADERS, CONTAINER_MIN_WIDTH } from './constants';
import {
  trackInfluxDBConfigV2ProductSelected,
  trackInfluxDBConfigV2QueryLanguageSelected,
  trackInfluxDBConfigV2URLInputField,
} from './tracking';
import { Props } from './types';
import { INFLUXDB_VERSION_MAP, InfluxDBProduct } from './versions';

const getQueryLanguageOptions = (productName: string): Array<{ value: string }> => {
  const product = INFLUXDB_VERSION_MAP.find(({ name }) => name === productName);
  return product?.queryLanguages?.map(({ name }) => ({ value: name })) ?? [];
};

export const UrlAndAuthenticationSection = (props: Props) => {
  const { options, onOptionsChange } = props;
  const styles = useStyles2(getStyles);

  const isInfluxVersion = (v: string): v is InfluxVersion =>
    typeof v === 'string' && (v === InfluxVersion.Flux || v === InfluxVersion.InfluxQL || v === InfluxVersion.SQL);

  // Database + Retention Policy (DBRP) mapping is required for InfluxDB OSS 1.x and 2.x when using InfluxQL
  const requiresDbrpMapping =
    options.jsonData.product &&
    options.jsonData.version === InfluxVersion.InfluxQL &&
    [
      'InfluxDB OSS 1.x',
      'InfluxDB OSS 2.x',
      'InfluxDB Enterprise 1.x',
      'InfluxDB Cloud (TSM)',
      'InfluxDB Cloud Serverless',
    ].includes(options.jsonData.product);

  const onProductChange = ({ value }: ComboboxOption) => {
    trackInfluxDBConfigV2ProductSelected({ product: value });
    onOptionsChange({ ...options, jsonData: { ...options.jsonData, product: value, version: undefined } });
  };

  const onQueryLanguageChange = (option: ComboboxOption) => {
    const { value } = option;
    trackInfluxDBConfigV2QueryLanguageSelected({ version: value });

    if (isInfluxVersion(value)) {
      onUpdateDatasourceJsonDataOptionSelect(props, 'version')(option);
    }
  };

  const onUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateDatasourceOption(props, 'url')(event);
  };

  const pingInfluxForProductDetection = async (urlValue: string) => {
    const dsId = options.id;
    if (!dsId) {
      return;
    }

    try {
      const res = await firstValueFrom(
        getBackendSrv().fetch({
          method: 'GET',
          url: `/api/datasources/proxy/${dsId}/ping`,
          headers: { Accept: 'application/json' },
          responseType: 'text',
          showErrorAlert: false,
          showSuccessAlert: false,
        })
      );
      if (res.ok) {
        let product: string | undefined;
        let version: string | undefined;

        if (res.headers && typeof res.headers.get === 'function') {
          product = res.headers.get('x-influxdb-build') ?? undefined;
          version = res.headers.get('x-influxdb-version') ?? undefined;
        }

        if (product || version) {
          return { product, version };
        }
      }
    } catch (err) {
      console.error('Failed to get InfluxDB version:', err);
    }

    return { product: undefined, version: undefined };
  };

  const matchUrlContains = async (urlValue: string) => {
    let product: InfluxDBProduct | undefined;
    product = INFLUXDB_VERSION_MAP.find((product: InfluxDBProduct) => {
      if (product.detectionMethod?.urlContains) {
        return product.detectionMethod.urlContains.some((url) => {
          return urlValue.includes(url);
        });
      }
      return false;
    });

    if (!product) {
      const pingUrl = await pingInfluxForProductDetection(urlValue);

      if (pingUrl) {
        product = INFLUXDB_VERSION_MAP.find((product: InfluxDBProduct) => {
          if (product.detectionMethod?.pingHeaderResponse) {
            const productBuild = product.detectionMethod.pingHeaderResponse['x-influxdb-build'];
            const productVersion = product.detectionMethod.pingHeaderResponse['x-influxdb-version'];
            const pingUrlVersion = pingUrl.version ?? '';
            const pingUrlBuild = pingUrl.product ?? '';
            const versionMatch = new RegExp(productVersion).test(pingUrlVersion);
            const buildMatch = pingUrlBuild.includes(productBuild);
            return versionMatch && buildMatch;
          }
          return false;
        });
      }
    }

    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        product: product ? product.name : undefined,
        version: undefined,
      },
    });
  };

  const detectProductFromUrl = (event: React.ChangeEvent<HTMLInputElement>) => {
    matchUrlContains(event.target.value);
  };

  return (
    <Box
      borderStyle="solid"
      borderColor="weak"
      padding={2}
      id={`${CONFIG_SECTION_HEADERS[0].id}`}
      minWidth={CONTAINER_MIN_WIDTH}
    >
      <CollapsableSection
        label={<Text element="h3">{CONFIG_SECTION_HEADERS[0].label}</Text>}
        isOpen={CONFIG_SECTION_HEADERS[0].isOpen}
      >
        <Text color="secondary">
          Enter the URL of your InfluxDB instance, then select your product and query language. This will determine the
          available settings and authentication methods in the next steps.
        </Text>
        <Box direction="column" marginTop={3}>
          <Field label="URL" noMargin required>
            <Input
              data-testid="influxdb-v2-config-url-input"
              placeholder="example: http://localhost:8086/"
              onChange={onUrlChange}
              value={options.url || ''}
              onBlur={(e) => {
                detectProductFromUrl(e);
                trackInfluxDBConfigV2URLInputField();
              }}
            />
          </Field>
          <Box marginTop={2}>
            <Stack direction="row" wrap="wrap" justifyContent="space-between">
              <div className={styles.col}>
                <Box width="100%" minWidth={37}>
                  <Field
                    label="Product"
                    description={
                      <div className={styles.dropdown}>
                        <Text color="secondary">
                          Use{' '}
                          <TextLink
                            href="https://docs.influxdata.com/influxdb3/enterprise/visualize-data/grafana/?section=influxdb3%252Fenterprise%252Fvisualize-data&detection_method=url_analysis"
                            variant="bodySmall"
                            external
                          >
                            InfluxDB detection
                          </TextLink>{' '}
                          to identify the product
                        </Text>
                      </div>
                    }
                    noMargin
                    required
                  >
                    <Combobox
                      data-testid="influxdb-v2-config-product-select"
                      value={options.jsonData.product}
                      options={INFLUXDB_VERSION_MAP.map(({ name }) => ({ value: name }))}
                      onChange={onProductChange}
                    />
                  </Field>
                </Box>
              </div>
              <div className={styles.col}>
                <Box width="100%" minWidth={37}>
                  <Field
                    label="Query language"
                    description={<div className={styles.dropdown}>The query language depends on product selection</div>}
                    noMargin
                    required
                  >
                    <Combobox
                      data-testid="influxdb-v2-config-query-language-select"
                      value={options.jsonData.product !== '' ? options.jsonData.version : ''}
                      options={getQueryLanguageOptions(options.jsonData.product || '')}
                      onChange={onQueryLanguageChange}
                    />
                  </Field>
                </Box>
              </div>
            </Stack>
          </Box>
          <Space v={2} />
          {requiresDbrpMapping && (
            <Alert severity="warning" title="InfluxQL requires DBRP mapping">
              {`${options.jsonData.product} requires a Database + Retention Policy (DBRP) mapping via the CLI or
              API before data can be queried.`}{' '}
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
  );
};

const getStyles = () => {
  return {
    dropdown: css({
      display: 'flex',
      alignItems: 'center',
      height: '18px',
    }),
    col: css({
      flex: '1 1 48%',
      minWidth: '320px',
    }),
    '@media (max-width: 768px)': {
      flexBasis: '100%',
    },
  };
};
