import React, { FC } from 'react';

import { InfoBox } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { TemplateForm } from './TemplateForm';

interface Props {
  templateName: string;
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export const EditTemplateView: FC<Props> = ({ config, templateName, alertManagerSourceName }) => {
  const template = config.template_files?.[templateName];
  const provenance = config.template_file_provenances?.[templateName];

  if (!template) {
    return (
      <InfoBox severity="error" title="Template not found">
        Sorry, this template does not seem to exit.
      </InfoBox>
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
