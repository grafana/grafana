import React from 'react';

import { Alert } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { TemplateForm } from './TemplateForm';

interface Props {
  templateName: string;
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export const EditTemplateView = ({ config, templateName, alertManagerSourceName }: Props) => {
  const template = config.template_files?.[templateName];
  const provenance = config.template_file_provenances?.[templateName];

  if (!template) {
    return (
      <Alert severity="error" title="Template not found">
        Sorry, this template does not seem to exists.
      </Alert>
    );
  }
  return (
    <TemplateForm
      alertManagerSourceName={alertManagerSourceName}
      config={config}
      existing={{ name: templateName, content: template }}
      provenance={provenance}
    />
  );
};
