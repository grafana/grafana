import { Trans, t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { useWizardContext } from '../components/Wizard/wizardContext';

import { useCorrelationsFormContext } from './correlationsFormContext';

export const CorrelationFormNavigation = () => {
  const { currentPage, prevPage, isLastPage } = useWizardContext();
  const { readOnly, loading, correlation } = useCorrelationsFormContext();

  const LastPageNext = !readOnly && (
    <Button variant="primary" icon={loading ? 'spinner' : 'save'} type="submit" disabled={loading}>
      {correlation === undefined
        ? t('correlations.navigation-form.add-button', 'Add')
        : t('correlations.navigation-form.save-button', 'Save')}
    </Button>
  );

  const NextPage = (
    <Button variant="primary" type="submit">
      <Trans i18nKey="correlations.navigation-form.next-button">Next</Trans>
    </Button>
  );

  return (
    <Stack justifyContent="flex-start">
      {currentPage > 0 ? (
        <Button variant="secondary" onClick={prevPage}>
          <Trans i18nKey="correlations.navigation-form.back-button">Back</Trans>
        </Button>
      ) : undefined}

      {isLastPage ? LastPageNext : NextPage}
    </Stack>
  );
};
