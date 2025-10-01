import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { RuleFormType } from '../../../../types/rule-form';
import { isRecordingRuleByType } from '../../../../utils/rules';

import { EvaluationAndRecipientSection } from './EvaluationAndRecipientSection';
import { QueryAndExpressionSection } from './QueryAndExpressionSection';
import { RuleDefinitionSection } from './RuleDefinitionSection';

type Props = {
  type: RuleFormType;
  sparkJoy?: boolean;
  isSubmitting: boolean;
  onSaveClick: () => void;
  onCancelClick: () => void;
};

export function AlertRuleFormContentsSimplified({ type, sparkJoy, isSubmitting, onSaveClick, onCancelClick }: Props) {
  const styles = useStyles2(getStyles);

  isRecordingRuleByType(type);

  return (
    <div>
      <RuleDefinitionSection type={type} />

      <div className={styles.divider} aria-hidden="true" />

      <QueryAndExpressionSection sparkJoy={sparkJoy} />

      <div className={styles.divider} aria-hidden="true" />

      <EvaluationAndRecipientSection type={type} />

      <div className={styles.actionsRow}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Button
            data-testid="save-rule"
            variant="primary"
            type="button"
            onClick={onSaveClick}
            disabled={isSubmitting}
            icon={isSubmitting ? 'spinner' : undefined}
          >
            <Trans i18nKey="alerting.alert-rule-form.button-save">Save</Trans>
          </Button>
          <Button type="button" variant="secondary" onClick={onCancelClick} disabled={isSubmitting}>
            {t('alerting.alert-rule-form.button-cancel', 'Cancel')}
          </Button>
        </Stack>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    section: css({
      width: '100%',
    }),
    sectionHeaderRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1),
    }),
    sectionHeader: css({
      fontWeight: 600,
      fontSize: theme.typography.h4.fontSize,
      lineHeight: theme.typography.h4.lineHeight,
    }),
    stepBadge: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 20,
      width: 20,
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.primary.main,
      color: theme.colors.text.maxContrast,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: 600,
    }),
    contentIndented: css({
      marginLeft: `calc(20px + ${theme.spacing(1)})`,
    }),
    divider: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: `${theme.spacing(3)} 0`,
      width: '100%',
    }),
    actionsRow: css({
      marginTop: theme.spacing(4),
    }),
  };
}

export default AlertRuleFormContentsSimplified;
