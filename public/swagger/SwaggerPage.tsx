import { Global } from '@emotion/react';
import { useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import SwaggerUI from 'swagger-ui-react';

import { createTheme, ThemeContext } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Combobox, Icon, Stack, UserIcon } from '@grafana/ui';

import { SpecOption } from './SpecOption';
import { type APIGroupList, buildSpecs } from './apiSpecs';
import { NamespaceContext } from './contexts';
import { WrappedPlugins } from './plugins';
import { loadWhoAmI } from './whoami';

async function loadGroupList(): Promise<APIGroupList | undefined> {
  // Only used to mark preferred versions, so the picker still works without it.
  try {
    const rsp = await fetch('apis');
    return rsp.ok ? await rsp.json() : undefined;
  } catch {
    return undefined;
  }
}

export const Page = () => {
  const theme = createTheme({ colors: { mode: 'light' } });
  const [api, setAPI] = useState<string>();
  const specs = useAsync(async () => {
    const [openapi, groupList] = await Promise.all([fetch('openapi/v3').then((rsp) => rsp.json()), loadGroupList()]);
    const specs = buildSpecs(openapi.paths, groupList);

    const requested = new URLSearchParams(window.location.search).get('api');
    setAPI((specs.find((s) => s.key === requested) ?? specs[0]).key); // Remove to start at the generic landing page
    return specs;
  });
  const specsByKey = useMemo(() => new Map(specs.value?.map((s) => [s.key, s])), [specs.value]);
  const options = useMemo(
    () => specs.value?.map((s) => ({ label: s.label, value: s.key, ...(s.group && { group: s.group }) })) ?? [],
    [specs.value]
  );
  const spec = api ? specsByKey.get(api) : undefined;

  const whoami = useAsync(loadWhoAmI);
  const namespace = whoami.value?.namespace;
  const userView = whoami.value?.userView;

  return (
    <div>
      <ThemeContext.Provider value={theme}>
        <Global
          styles={{
            // Sizes include padding and borders, as in Grafana: otherwise an input
            // with a width overflows into what follows it.
            html: {
              fontSize: `${theme.typography.htmlFontSize}px`,
              boxSizing: 'border-box',
            },
            '*, *::before, *::after': {
              boxSizing: 'inherit',
            },
            body: {
              margin: 0,
              ...theme.typography.body,
            },
          }}
        />
        <NamespaceContext.Provider value={namespace}>
          <div style={{ backgroundColor: '#000', padding: '10px' }}>
            <Stack alignItems="center" justifyContent="space-between">
              <Stack alignItems="center" gap={3}>
                <Icon name="grafana" size="xxl" />
                <Combobox
                  width={60}
                  options={options}
                  isClearable={false /* TODO -- when we allow a landing page, this can be true */}
                  onChange={(option) => {
                    const url = new URL(window.location.href);
                    url.hash = '';
                    url.searchParams.set('api', option.value);
                    window.history.pushState(null, '', url);
                    setAPI(option.value);
                  }}
                  value={api ?? null}
                  loading={specs.loading}
                  renderOption={(option) => {
                    const spec = specsByKey.get(option.value);
                    return spec ? <SpecOption spec={spec} /> : option.label;
                  }}
                />
              </Stack>
              <div>
                {userView ? (
                  <UserIcon userView={userView} />
                ) : (
                  <a href="/login">
                    <Button variant="primary">
                      <Trans i18nKey="swagger.login">Login</Trans>
                    </Button>
                  </a>
                )}
              </div>
            </Stack>
          </div>

          {!whoami.loading && !namespace && (
            <Alert title={t('swagger.namespace-unavailable-title', 'Unable to load namespace')} severity="warning">
              <Trans i18nKey="swagger.namespace-unavailable">
                Check the namespace before sending requests, or reload the page to try again.
              </Trans>
            </Alert>
          )}
          {spec && !whoami.loading && (
            <SwaggerUI
              url={spec.url}
              presets={[WrappedPlugins]}
              deepLinking={true}
              tryItOutEnabled={true}
              queryConfigEnabled={false}
              persistAuthorization={false}
              displayOperationId
            />
          )}
          {(!spec || whoami.loading) && <div>...{/** TODO, we can make an api docs loading page here */}</div>}
        </NamespaceContext.Provider>
      </ThemeContext.Provider>
    </div>
  );
};
