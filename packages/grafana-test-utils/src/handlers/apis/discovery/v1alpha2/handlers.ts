import { HttpResponse, http } from 'msw';

export const MANIFESTS_URL = '/apis/discovery/v1alpha2/manifests';

const listManifestsHandler = () =>
  http.get(MANIFESTS_URL, () =>
    HttpResponse.json({
      apiVersion: 'apps.grafana.app/v1alpha2',
      kind: 'AppManifestList',
      items: [],
    })
  );

export default [listManifestsHandler()];
