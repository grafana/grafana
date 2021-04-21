import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { TemplateForm } from './TemplateForm';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export const NewTemplateView: FC<Props> = ({ config, alertManagerSourceName }) => {
  return <TemplateForm config={config} alertManagerSourceName={alertManagerSourceName} />;
};
