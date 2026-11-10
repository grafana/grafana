import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { Alert, Combobox, Field, LoadingPlaceholder, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { getFallbackNavModel } from '../realdata/RealDrilldownPage';

import { ServiceScope } from './ServiceScope';
import { type HomeService, loadHome } from './loadHome';

type State = { kind: 'loading' } | { kind: 'ready'; services: HomeService[] } | { kind: 'error'; message: string };

// Wireframe 2 and 3 as views of their own: pick a service, then see its scope with the four signals.
function ServiceView({ openMapping }: { openMapping: boolean }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [name, setName] = useState<string>();
  const hasNav = useNavModel('drilldown').node.id !== 'not-found';

  useEffect(() => {
    let cancelled = false;
    loadHome()
      .then((data) => !cancelled && setState({ kind: 'ready', services: data.services }))
      .catch((error: Error) => !cancelled && setState({ kind: 'error', message: error.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  const services = state.kind === 'ready' ? state.services : [];
  // The service that changed most comes first, so it is the default pick.
  const selected = services.find((service) => service.name === name) ?? services[0];

  return (
    <Page navId={hasNav ? 'drilldown' : undefined} navModel={hasNav ? undefined : getFallbackNavModel()}>
      <Page.Contents>
        {state.kind === 'loading' && (
          <LoadingPlaceholder text={t('drilldown-otel.loading', 'Querying the OTel lab data sources')} />
        )}
        {state.kind === 'error' && (
          <Alert severity="error" title={t('drilldown-otel.error', 'Could not query the OTel lab data sources')}>
            {state.message}
          </Alert>
        )}
        {state.kind === 'ready' && selected && (
          <Stack direction="column" gap={3}>
            <Field noMargin label={t('drilldown-otel.view.service', 'Service')}>
              <Combobox
                width={32}
                value={selected.name}
                options={services.map((service) => ({ label: service.name, value: service.name }))}
                onChange={(option) => setName(option?.value)}
              />
            </Field>
            <ServiceScope key={`${selected.name}-${openMapping}`} service={selected} openMapping={openMapping} />
          </Stack>
        )}
      </Page.Contents>
    </Page>
  );
}

export function OtelFirstScopeView() {
  return <ServiceView openMapping={false} />;
}

export function OtelFirstMappingView() {
  return <ServiceView openMapping={true} />;
}
