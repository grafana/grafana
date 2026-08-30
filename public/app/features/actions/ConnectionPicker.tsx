import { useEffect, useMemo, useState } from 'react';

import { ActionType, type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';
import { Select } from '@grafana/ui';

import { INFINITY_DATASOURCE_TYPE } from './utils';

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
  onChange: (connectionType: 'direct' | DataSourceInstanceListItem) => void;
  id?: string;
}

const DIRECT_OPTION_VALUE = 'direct';

export const ConnectionPicker = ({ actionType, datasourceUid, onChange, id }: ConnectionPickerProps) => {
  const [supportedDataSources, setSupportedDataSources] = useState<DataSourceInstanceListItem[]>([]);
  useEffect(() => {
    if (config.featureToggles.vizActionsAuth) {
      getDataSourceInstanceList({
        filter: (item) => item.type === INFINITY_DATASOURCE_TYPE,
      }).then(setSupportedDataSources);
    }
  }, []);

  const connectionOptions = useMemo(() => {
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
    supportedDataSources.forEach((ds) => {
      options.push({
        label: ds.name,
        value: ds.uid,
        imgUrl: ds.meta.info.logos.small,
      });
    });

    return options;
  }, [supportedDataSources]);

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
      const selected = supportedDataSources.find((ds) => ds.uid === selectedValue);
      if (selected) {
        onChange(selected);
      }
    }
  };

  const currentValue = getCurrentValue();

  return (
    <Select
      inputId={id}
      value={currentValue}
      options={connectionOptions}
      onChange={(selected) => handleConnectionChange(selected.value!)}
      placeholder={t('grafana-ui.action-editor.modal.connection-placeholder', 'Select connection')}
    />
  );
};
