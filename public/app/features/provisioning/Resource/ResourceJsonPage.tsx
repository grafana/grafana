import { useParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { config, getBackendSrv } from '@grafana/runtime';
import { Alert, CodeEditor } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

export default function ResourceJsonPage() {
  const { group = '', resource = '', name = '' } = useParams();
  const state = useAsync(async () => {
    const get = <T,>(url: string) => getBackendSrv().get<T>(url, undefined, undefined, { showErrorAlert: false });
    const discovery = await get<{ preferredVersion?: { groupVersion?: string } }>(`/apis/${group}`);
    return get(`/apis/${discovery.preferredVersion?.groupVersion}/namespaces/${config.namespace}/${resource}/${name}`);
  }, [group, resource, name]);

  return (
    <Page navId="provisioning" pageNav={{ text: name, subTitle: `${resource}.${group}` }}>
      <Page.Contents isLoading={state.loading}>
        {state.error && <Alert title={state.error.message} />}
        {state.value !== undefined && (
          <CodeEditor value={JSON.stringify(state.value, null, 2)} language="json" readOnly height={600} />
        )}
      </Page.Contents>
    </Page>
  );
}
