import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { ReceiversTable } from './ReceiversTable';
import { TemplatesTable } from './TemplatesTable';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerName: string;
}

export const ReceiversAndTemplatesView: FC<Props> = ({ config, alertManagerName }) => (
  <>
    <TemplatesTable config={config} alertManagerName={alertManagerName} />
    <ReceiversTable config={config} alertManagerName={alertManagerName} />
  </>
);
