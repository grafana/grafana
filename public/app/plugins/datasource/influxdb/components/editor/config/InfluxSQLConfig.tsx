import React, { useEffect, useState } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { InlineField, SecretInput, Input, InlineFieldRow, InlineLabel } from '@grafana/ui';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions, InfluxSecureJsonData>;

type MetadataState = Array<{ key: string; value: string }>;

export const addMetaData = (setMetaData: (val: MetadataState) => void, metaDataArr: MetadataState) => {
  setMetaData([...metaDataArr, { key: '', value: '' }]);
};

export const removeMetaData = (i: number, setMetaData: (val: MetadataState) => void, metaDataArr: MetadataState) => {
  const newMetaValues = [...metaDataArr];
  newMetaValues.splice(i, 1);
  setMetaData(newMetaValues);
};

export const onKeyChange = (
  key: string,
  metaDataArr: MetadataState,
  index: number,
  setMetaData: (val: MetadataState) => void
) => {
  const newMetaValues = [...metaDataArr];
  newMetaValues[index]['key'] = key;
  setMetaData(newMetaValues);
};

export const onValueChange = (
  value: string,
  metaDataArr: MetadataState,
  index: number,
  setMetaData: (val: MetadataState) => void
) => {
  const newMetaValues = [...metaDataArr];
  newMetaValues[index]['value'] = value;
  setMetaData(newMetaValues);
};

export const InfluxSqlConfig = (props: Props) => {
  const {
    options: { jsonData, secureJsonData, secureJsonFields },
  } = props;

  const existingMetadata: MetadataState = jsonData?.metadata?.length
    ? jsonData?.metadata?.map((md) => ({ key: Object.keys(md)[0], value: Object.values(md)[0] }))
    : [{ key: 'bucket-name', value: '' }];
  const [metaDataArr, setMetaData] = useState<MetadataState>(existingMetadata);

  useEffect(() => {
    const { onOptionsChange, options } = props;
    const mapData = metaDataArr?.map((m) => ({ [m.key]: m.value }));
    const jsonData = {
      ...options.jsonData,
      metadata: mapData,
    };
    onOptionsChange({
      ...options,
      jsonData,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaDataArr]);

  return (
    <div>
      <div className="gf-form">
        <h6>Token</h6>
      </div>
      <div>
        <InlineField labelWidth={20} label="Token">
          <SecretInput
            width={40}
            name="token"
            type="text"
            value={secureJsonData?.token || ''}
            onReset={() => updateDatasourcePluginResetOption(props, 'token')}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
            isConfigured={secureJsonFields?.token}
          />
        </InlineField>
      </div>
      <div>
        <div className="gf-form">
          <h6>MetaData</h6>
        </div>
        {metaDataArr?.map((_, i) => (
          <InlineFieldRow key={i} style={{ flexFlow: 'row' }}>
            <InlineField labelWidth={20} label="Key">
              <Input
                key={i}
                width={40}
                name="key"
                type="text"
                value={metaDataArr[i]?.key || ''}
                placeholder="key"
                onChange={(e) => onKeyChange(e.currentTarget.value, metaDataArr, i, setMetaData)}
              ></Input>
            </InlineField>
            <InlineField labelWidth={20} label="Value">
              <Input
                key={i}
                width={40}
                name="value"
                type="text"
                value={metaDataArr[i]?.value?.toString() ?? ''}
                placeholder="value"
                onChange={(e) => onValueChange(e.currentTarget.value, metaDataArr, i, setMetaData)}
              ></Input>
            </InlineField>
            {i + 1 >= metaDataArr.length && (
              <InlineLabel as="button" className="" onClick={() => addMetaData(setMetaData, metaDataArr)} width="auto">
                +
              </InlineLabel>
            )}
            {i > 0 && (
              <InlineLabel
                as="button"
                className=""
                width="auto"
                onClick={() => removeMetaData(i, setMetaData, metaDataArr)}
              >
                -
              </InlineLabel>
            )}
          </InlineFieldRow>
        ))}
      </div>
    </div>
  );
};
