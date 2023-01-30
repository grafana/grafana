import React, { FC } from 'react';

import { Alert } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { updateAndSanitizeDefine } from '../../utils/templates';

import { TemplateForm } from './TemplateForm';

interface Props {
  templateName: string;
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
}

export function generateCopiedTemplateName(config: AlertManagerCortexConfig, originalTemplateName: string): string {
  const existingTemplates = Object.keys(config.template_files);
  const nonDuplicateName = originalTemplateName.replace(/\(copy( [0-9]+)?\)$/, '').trim();

  let newName = `${nonDuplicateName} (copy)`;

  for (let i = 2; existingTemplates.includes(newName); i++) {
    newName = `${nonDuplicateName} (copy ${i})`;
  }

  return newName;
}

export const DuplicateTemplateView: FC<Props> = ({ config, templateName, alertManagerSourceName }) => {
  const template = config.template_files?.[templateName];

  if (!template) {
    return (
      <Alert severity="error" title="Template not found">
        Sorry, this template does not seem to exit.
      </Alert>
    );
  }

  const duplicatedName = generateCopiedTemplateName(config, templateName);

  return (
    <TemplateForm
      alertManagerSourceName={alertManagerSourceName}
      config={config}
      existing={{ name: duplicatedName, content: updateAndSanitizeDefine(duplicatedName, template) }}
    />
  );
};
