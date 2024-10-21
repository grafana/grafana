import getDefaultMonacoLanguages from 'lib/monaco-languages';
import { useState } from 'react';
import { useAsync } from 'react-use';
import SwaggerUI from 'swagger-ui-react';

import { createTheme, monacoLanguageRegistry, SelectableValue } from '@grafana/data';
import { Stack, Select } from '@grafana/ui';
import { setMonacoEnv } from 'app/core/monacoEnv';
import { ThemeProvider } from 'app/core/utils/ConfigProvider';

import { NamespaceContext, WrappedPlugins } from './plugins';

export const Page = () => {
  const theme = createTheme({ colors: { mode: 'light' } });
  const [url, setURL] = useState<SelectableValue<string>>();
  const urls = useAsync(async () => {
    const v2 = { label: 'Grafana API (OpenAPI v2)', key: 'openapi2', value: 'public/api-merged.json' };
    const v3 = { label: 'Grafana API (OpenAPI v3)', key: 'openapi3', value: 'public/openapi3.json' };
    const urls: Array<SelectableValue<string>> = [v2, v3];

    const rsp = await fetch('openapi/v3');
    const apis = await rsp.json();
    for (const [key, val] of Object.entries<any>(apis.paths)) {
      const parts = key.split('/');
      if (parts.length === 3) {
        urls.push({
          key: `${parts[1]}-${parts[2]}`,
          label: `${parts[1]}/${parts[2]}`,
          value: val.serverRelativeURL.substring(1), // remove initial slash
        });
      }
    }

    let idx = 0;
    const urlParams = new URLSearchParams(window.location.search);
    const api = urlParams.get('api');
    if (api) {
      urls.forEach((url, i) => {
        if (url.key === api) {
          idx = i;
        }
      });
    }

    monacoLanguageRegistry.setInit(getDefaultMonacoLanguages);
    setMonacoEnv();

    setURL(urls[idx]); // Remove to start at the generic landing page
    return urls;
  });

  const namespace = useAsync(async () => {
    const response = await fetch('api/frontend/settings');
    if (!response.ok) {
      console.warn('No settings found');
      return '';
    }
    const val = await response.json();
    return val.namespace;
  });

  return (
    <div>
      <ThemeProvider value={theme}>
        <NamespaceContext.Provider value={namespace.value}>
          <div style={{ backgroundColor: '#000', padding: '10px' }}>
            <Stack justifyContent={'space-between'}>
              <img height="40" src="public/img/grafana_icon.svg" alt="Grafana" />
              <Select
                options={urls.value}
                isClearable={false /* TODO -- when we allow a landing page, this can be true */}
                onChange={(v) => {
                  const url = new URL(window.location.href);
                  url.hash = '';
                  if (v?.key) {
                    url.searchParams.set('api', v.key);
                  } else {
                    url.searchParams.delete('api');
                  }
                  history.pushState(null, '', url);
                  setURL(v);
                }}
                value={url}
                isLoading={urls.loading}
              />
            </Stack>
          </div>

          {url?.value && (
            <SwaggerUI
              url={url.value}
              presets={[WrappedPlugins]}
              deepLinking={true}
              tryItOutEnabled={true}
              queryConfigEnabled={false}
              persistAuthorization={false}
            />
          )}

          {!url?.value && <div>...{/** TODO, we can make an api docs loading page here */}</div>}
        </NamespaceContext.Provider>
      </ThemeProvider>
    </div>
  );
};
