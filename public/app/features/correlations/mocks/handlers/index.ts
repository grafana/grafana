import { HttpResponse, http } from 'msw';

import {
  CreateCorrelationApiResponse,
  ListCorrelationApiResponse,
} from '@grafana/api-clients/rtkq/correlations/v0alpha1';

export const getCorrelationsHandler = (
  data: ListCorrelationApiResponse | ((info: Parameters<Parameters<typeof http.get>[1]>[0]) => Response)
) =>
  http.get('/apis/correlations.grafana.app/v0alpha1/namespaces/:namespace/correlations', ({ request }) => {
    return HttpResponse.json(data);
  });

export const createCorrelationsHandler = (
  data: CreateCorrelationApiResponse | ((info: Parameters<Parameters<typeof http.get>[1]>[0]) => Response)
) =>
  http.post('/apis/correlations.grafana.app/v0alpha1/namespaces/:namespace/correlations', ({ request }) => {
    return HttpResponse.json(data);
  });
