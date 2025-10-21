import { css } from '@emotion/css';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Drawer, useStyles2 } from '@grafana/ui';
import { RuleDefinitionSection } from 'app/features/alerting/unified/components/RuleDefinitionSection';

import { getDefaultFormValues } from '../rule-editor/formDefaults';
import { RuleFormType, RuleFormValues } from '../types/rule-form';

import { RuleConditionSection } from './RuleConditionSection';
import { RuleNotificationSection } from './RuleNotificationSection';

export interface AlertRuleDrawerFormProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function AlertRuleDrawerForm({ isOpen, onClose, title }: AlertRuleDrawerFormProps) {
  const methods = useForm<RuleFormValues>({ defaultValues: getDefaultFormValues(RuleFormType.grafana) });
  const styles = useStyles2(getStyles);

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
        <div className={styles.divider} aria-hidden="true" />
        <RuleConditionSection type={RuleFormType.grafana} />
        <div className={styles.divider} aria-hidden="true" />
        <RuleNotificationSection />
        <div className={styles.divider} aria-hidden="true" />
      </FormProvider>
    </Drawer>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    divider: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: `${theme.spacing(3)} 0`,
      width: '100%',
    }),
  };
}
