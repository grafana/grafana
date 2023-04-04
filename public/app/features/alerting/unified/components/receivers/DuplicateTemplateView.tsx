import React from 'react';

import { Alert } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { generateCopiedName } from '../../utils/duplicate';
import { updateDefinesWithUniqueValue } from '../../utils/templates';

import { TemplateForm } from './TemplateForm';

interface Props {
  templateName: string;
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export const DuplicateTemplateView = ({ config, templateName, alertManagerSourceName }: Props) => {
  const template = config.template_files?.[templateName];

  if (!template) {
    return (
      <Alert severity="error" title="Template not found">
        Sorry, this template does not seem to exists.
      </Alert>
    );
  }

  const duplicatedName = generateCopiedName(templateName, Object.keys(config.template_files));

  return (
    <TemplateForm
      alertManagerSourceName={alertManagerSourceName}
      config={config}
      existing={{ name: duplicatedName, content: updateDefinesWithUniqueValue(template) }}
    />
  );
};
