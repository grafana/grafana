import React, { useState } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { Box, Combobox, ComboboxOption, Divider, Field, FieldSet, Input, Stack, Text } from '@grafana/ui';

import { InfluxOptions } from '../../../types';
export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

// This file is where the various versions of InfluxDB are mapped to their respective
// supported query languages. This is used to populate the dropdown in the config editor.
//
// If you need to add a new version of InfluxDB, you will need to add it to this file.
import { INFLUXDB_VERSION_MAP } from './versions';

function getQueryLanguageOptions(productName: string): Array<{ value: string }> {
  const product = INFLUXDB_VERSION_MAP.find(({ name }) => name === productName);
  return product?.queryLanguages?.map(({ name }) => ({ value: name })) ?? [];
}

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }: Props) => {
  const [product, setProduct] = useState({ name: '', language: '' });

  const onProductChange = ({ value }: ComboboxOption) => setProduct({ name: value, language: '' });
  const onQueryLanguageChange = ({ value }: ComboboxOption) => setProduct((prev) => ({ ...prev, language: value }));
  const onUrlChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    onOptionsChange({ ...options, url: event.currentTarget.value });

  return (
    <>
      <Stack direction="row" gap={8}>
        {/* Left sidebar */}
        <Stack width="20%" direction="row">
          <Box flex={1} marginY={2}>
            <Text element="h2">InfluxDB</Text>
          </Box>
          <Divider direction="vertical" />
        </Stack>

        {/* Main content */}
        <Box flex={1}>
          {/* URL */}
          <Box padding={2}>
            <FieldSet label="Connection Configuration">
              <Text>
                Configure the connection settings for your InfluxDB instance. This needs to be accessible from your
                Grafana server.
              </Text>

              <Box direction="column" gap={2} marginTop={2}>
                <Field label="URL" description="The URL to the InfluxDB instance.">
                  <Input placeholder="http://localhost:3000/" onChange={onUrlChange} />
                </Field>
              </Box>
            </FieldSet>
          </Box>

          {/* Product selection */}
          <Box borderStyle="solid" borderColor="weak" padding={2} marginBottom={4}>
            <FieldSet label="Product Selection">
              <Text>
                Select the InfluxDB product that you are configuring. This choice determines the available settings and
                authentication methods in the next steps. If you're unsure, check your InfluxDB version, or refer to the
                documentation.
              </Text>

              <Box marginTop={2}>
                <Stack direction="row" gap={2}>
                  <Box flex={1}>
                    <Field label="Product selection">
                      <Combobox
                        options={INFLUXDB_VERSION_MAP.map(({ name }) => ({ value: name }))}
                        onChange={onProductChange}
                      />
                    </Field>
                  </Box>
                  <Box flex={1}>
                    <Field label="Query language">
                      <Combobox
                        value={product.language}
                        options={getQueryLanguageOptions(product.name)}
                        onChange={onQueryLanguageChange}
                      />
                    </Field>
                  </Box>
                </Stack>
              </Box>
            </FieldSet>
          </Box>

          {/* Authentication */}
          <Box borderStyle="solid" borderColor="weak" padding={2} marginBottom={4}>
            <FieldSet label="Authentication">
              <Text>
                Configure authentication settings for your InfluxDB instance. This is required to access your data.
                Ensure to limit access to the necessary permissions only.
              </Text>
            </FieldSet>
          </Box>

          {/* Security */}
          <Box borderStyle="solid" borderColor="weak" padding={2} marginBottom={4}>
            <FieldSet label="SSL/TLS Configuration">
              <Text>
                Configure SSL/TLS settings for secure communication with your InfluxDB instance. This is recommended for
                production environments.
              </Text>
            </FieldSet>
          </Box>

          {/* PDC */}
          <Box borderStyle="solid" borderColor="weak" padding={2} marginBottom={4}>
            <FieldSet label="Private Datasource Connect (PDC)">
              <Text>
                PDC is a feature that allows you to connect to your InfluxDB instance without exposing it to the public
                internet. This is useful for security reasons, or if your InfluxDB instance is behind a firewall.
              </Text>
            </FieldSet>
          </Box>
        </Box>

        {/* Right sidebar */}
        <Box width="20%">
          {/* DS Version info */}
          <Box borderStyle="solid" borderColor="weak" padding={2} marginBottom={4}>
            <Text element="h3">Column 3</Text>
          </Box>

          {/* Links */}
          <Box borderStyle="solid" borderColor="weak" padding={2}>
            <Text element="h3">Column 3</Text>
          </Box>
        </Box>
      </Stack>
    </>
  );
};
