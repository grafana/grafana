import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, LoadingPlaceholder, Stack, Text } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { useSilenceViewData } from '../../hooks/useSilenceViewData';
import { stringifyErrorLike } from '../../utils/misc';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';

import { SilenceStateTag } from './SilenceStateTag';
import { SilenceViewContent } from './SilenceViewContent';

function Title({ title }: { title: string }) {
  const { silence } = useSilenceViewData();
  const silenceState = silence?.status.state;

  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Text variant="h1">{title}</Text>
      {silenceState && <SilenceStateTag state={silenceState} />}
    </Stack>
  );
}

function SilenceView() {
  const { silence, silencedAlerts, isLoading, error } = useSilenceViewData();
  const isNotFound = isFetchError(error) && error.status === 404;

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.silence-view.loading', 'Loading silence...')} />;
  }

  if (isNotFound) {
    return <EntityNotFound entity="Silence" />;
  }

  if (error) {
    return (
      <Alert severity="error" title={t('alerting.silence-view.error', 'Error loading silence')}>
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (!silence) {
    return <EntityNotFound entity="Silence" />;
  }

  return <SilenceViewContent silence={silence} silencedAlerts={silencedAlerts} />;
}

function SilenceViewPage() {
  const pageNav = {
    id: 'silence-view',
    text: t('alerting.silence-view.page-nav.text', 'Silence'),
    parentItem: {
      text: t('alerting.silence-view.page-nav.parent', 'Silences'),
      url: '/alerting/silences',
    },
  };

  return (
    <AlertmanagerPageWrapper
      navId="silences"
      pageNav={pageNav}
      accessType="instance"
      renderTitle={(title) => <Title title={title} />}
    >
      <SilenceView />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(SilenceViewPage);
