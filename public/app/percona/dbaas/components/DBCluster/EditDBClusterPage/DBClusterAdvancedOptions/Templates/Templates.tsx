import React, { FC } from 'react';

import { AsyncSelectFieldCore } from 'app/percona/shared/components/Form/AsyncSelectFieldCore';

import { AdvancedOptionsFields } from '../DBClusterAdvancedOptions.types';

import { Messages } from './Templates.messages';
import { TemplatesService } from './Templates.service';
import { TemplatesProps } from './Templates.types';

export const Templates: FC<TemplatesProps> = ({ k8sClusterName, databaseType }) => {
  return (
    <AsyncSelectFieldCore
      name={AdvancedOptionsFields.template}
      label={Messages.labels.templates}
      loadOptions={() => TemplatesService.loadTemplatesOptions(k8sClusterName, databaseType)}
      defaultOptions
    />
  );
};

export default Templates;
