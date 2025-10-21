import { FormProvider, useForm } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Drawer } from '@grafana/ui';
import { RuleDefinitionSection } from 'app/features/alerting/unified/components/RuleDefinitionSection';

import { getDefaultFormValues } from '../rule-editor/formDefaults';
import { RuleFormType, RuleFormValues } from '../types/rule-form';

export interface AlertRuleDrawerFormProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function AlertRuleDrawerForm({ isOpen, onClose, title }: AlertRuleDrawerFormProps) {
  const methods = useForm<RuleFormValues>({ defaultValues: getDefaultFormValues(RuleFormType.grafana) });

  if (!isOpen) {
    return null;
  }

  return (
    <Drawer
      title={title ?? t('alerting.new-rule-from-panel-button.new-alert-rule', 'New alert rule')}
      onClose={onClose}
    >
      <FormProvider {...methods}>
        <RuleDefinitionSection type={RuleFormType.grafana} />
      </FormProvider>
    </Drawer>
  );
}
