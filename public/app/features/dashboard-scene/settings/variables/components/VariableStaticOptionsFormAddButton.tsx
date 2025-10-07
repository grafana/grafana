import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { Button } from '@grafana/ui';

interface VariableStaticOptionsFormAddButtonProps {
  onAdd: () => void;
}

export const VariableStaticOptionsFormAddButton = ({ onAdd }: VariableStaticOptionsFormAddButtonProps) => {
  return (
    <Button
      icon="plus"
      variant="secondary"
      onClick={onAdd}
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsAddButton}
      aria-label={t('variables.query-variable-static-options.add-option-button-label', 'Add new option')}
    >
      <Trans i18nKey="variables.query-variable-static-options.add-option-button-label">Add new option</Trans>
    </Button>
  );
};
