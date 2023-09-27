import React from 'react';

import { Button, HorizontalGroup } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useWizardContext } from '../components/Wizard/wizardContext';

import { useCorrelationsFormContext } from './correlationsFormContext';

export const CorrelationFormNavigation = () => {
  const { currentPage, prevPage, isLastPage } = useWizardContext();
  const { readOnly, loading, correlation } = useCorrelationsFormContext();

  const LastPageNext = !readOnly && (
    <Button variant="primary" icon={loading ? 'fa fa-spinner' : 'save'} type="submit" disabled={loading}>
      {correlation === undefined
        ? t('correlations.nav-form.add-btn', 'Add')
        : t('correlations.nav-form.save-btn', 'Save')}
    </Button>
  );

  const NextPage = (
    <Button variant="primary" type="submit">
      <Trans i18nKey="correlations.nav-form.next-btn">Next</Trans>
    </Button>
  );

  return (
    <HorizontalGroup justify="flex-start">
      {currentPage > 0 ? (
        <Button variant="secondary" onClick={prevPage}>
          <Trans i18nKey="correlations.nav-form.back-btn">Back</Trans>
        </Button>
      ) : undefined}

      {isLastPage ? LastPageNext : NextPage}
    </HorizontalGroup>
  );
};
