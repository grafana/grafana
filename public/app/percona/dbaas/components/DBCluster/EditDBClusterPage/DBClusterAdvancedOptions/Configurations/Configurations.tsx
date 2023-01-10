import { TextareaInputField, AsyncSelectField } from '@percona/platform-core';
import React, { FC, useMemo } from 'react';

import FieldSet from '../../../../../../shared/components/Form/FieldSet/FieldSet';
import { Databases } from '../../../../../../shared/core';
import { Messages } from '../DBClusterAdvancedOptions.messages';

import { ConfigurationService } from './Configurations.service';
import { ConfigurationFields, ConfigurationProps } from './Configurations.types';

export const Configurations: FC<ConfigurationProps> = ({ databaseType, k8sClusterName }) => {
  const label = useMemo(
    () =>
      databaseType === Databases.mysql
        ? Messages.labels.pxcConfiguration
        : databaseType === Databases.mongodb
        ? Messages.labels.mongodbConfiguration
        : Messages.labels.commonConfiguration,
    [databaseType]
  );
  const fieldSetLabel = useMemo(
    () =>
      databaseType === Databases.mysql
        ? Messages.fieldSets.pxcConfiguration
        : databaseType === Databases.mongodb
        ? Messages.fieldSets.mongodbConfiguration
        : Messages.fieldSets.commonConfiguration,
    [databaseType]
  );

  return (
    <FieldSet label={fieldSetLabel} data-testid="configurations">
      <AsyncSelectField
        name={ConfigurationFields.storageClass}
        loadOptions={() => ConfigurationService.loadStorageClassOptions(k8sClusterName)}
        defaultOptions
        placeholder={Messages.placeholders.storageClass}
        label={Messages.labels.storageClass}
      />
      <TextareaInputField name={ConfigurationFields.configuration} label={label} />
    </FieldSet>
  );
};

export default Configurations;
