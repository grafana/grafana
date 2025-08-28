import { useMemo } from 'react';

import { ActionType, DataSourceInstanceSettings, SupportedDataSourceTypes } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { Select } from '@grafana/ui';

interface ConnectionOption {
  label: string;
  value: string;
  description?: string;
  imgUrl?: string;
  icon?: string;
}

interface ConnectionPickerProps {
  actionType: ActionType;
  datasourceUid?: string;
  onChange: (connectionType: 'direct' | DataSourceInstanceSettings) => void;
}

const DIRECT_OPTION_VALUE = 'direct';

const getSupportedDataSources = () => {
  const dataSourceSrv = getDataSourceSrv();
  const supportedTypes = Object.values(SupportedDataSourceTypes);

  return dataSourceSrv.getList({
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    filter: (ds) => supportedTypes.includes(ds.type as SupportedDataSourceTypes),
  });
};

export const ConnectionPicker = ({ actionType, datasourceUid, onChange }: ConnectionPickerProps) => {
  const connectionOptions: ConnectionOption[] = useMemo(() => {
    const options: ConnectionOption[] = [
      {
        label: t('grafana-ui.action-editor.modal.connection-direct-label', 'Direct from browser'),
        value: DIRECT_OPTION_VALUE,
        description: t(
          'grafana-ui.action-editor.modal.connection-direct-description',
          'Make request directly from browser'
        ),
        icon: 'adjust-circle',
      },
    ];

    if (config.featureToggles.vizActionsAuth) {
      const supportedDataSources = getSupportedDataSources();

      supportedDataSources.forEach((ds) => {
        options.push({
          label: ds.name,
          value: ds.uid,
          imgUrl: ds.meta.info.logos.small,
        });
      });
    }

    return options;
  }, []);

  const getCurrentValue = () => {
    if (actionType === ActionType.Fetch) {
      return DIRECT_OPTION_VALUE;
    } else if (actionType === ActionType.Infinity && datasourceUid) {
      return datasourceUid;
    }
    return DIRECT_OPTION_VALUE;
  };

  const handleConnectionChange = (selectedValue: string) => {
    if (selectedValue === DIRECT_OPTION_VALUE) {
      onChange(DIRECT_OPTION_VALUE);
    } else {
      const supportedDataSources = getSupportedDataSources();
      const selectedDatasource = supportedDataSources.find((ds) => ds.uid === selectedValue);
      if (selectedDatasource) {
        onChange(selectedDatasource);
      } else {
        console.error('ConnectionPicker: Could not find datasource with UID:', selectedValue);
      }
    }
  };

  const currentValue = getCurrentValue();

  return (
    <Select
      value={currentValue}
      options={connectionOptions}
      onChange={(selected) => handleConnectionChange(selected.value!)}
      placeholder={t('grafana-ui.action-editor.modal.connection-placeholder', 'Select connection')}
    />
  );
};
