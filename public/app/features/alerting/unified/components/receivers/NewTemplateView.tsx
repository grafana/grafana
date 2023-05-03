import React from 'react';

import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { TemplateForm } from './TemplateForm';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export const NewTemplateView = ({ config, alertManagerSourceName }: Props) => {
  return <TemplateForm config={config} alertManagerSourceName={alertManagerSourceName} />;
};
