import { HttpResponse, http } from 'msw';

import {
  type CreateCorrelationApiResponse,
  type ListCorrelationApiResponse,
  type DeleteCorrelationApiResponse,
  type UpdateCorrelationApiResponse,
} from '@grafana/api-clients/rtkq/correlations/v0alpha1';

import { mockCorrelationsMap } from './fixtures';

export const getCorrelationsHandler = (data: ListCorrelationApiResponse) =>
  http.get('/apis/correlations.grafana.app/v0alpha1/namespaces/:namespace/correlations', ({}) => {
    const corrItems = Array.from(mockCorrelationsMap.entries()).map((corrData) => {
      return corrData[1];
    });
    return HttpResponse.json({ ...data, items: corrItems });
  });

export const createCorrelationsHandler = (data: CreateCorrelationApiResponse) =>
  http.post('/apis/correlations.grafana.app/v0alpha1/namespaces/:namespace/correlations', ({}) => {
    if (data.metadata.uid) {
      mockCorrelationsMap.set(data.metadata.uid, data);
    }
    return HttpResponse.json(data);
  });

export const deleteCorrelationsHandler = (data: DeleteCorrelationApiResponse) =>
  http.delete('/apis/correlations.grafana.app/v0alpha1/namespaces/:namespace/correlations/:id', ({ params }) => {
    const { id } = params;
    if (id !== undefined && typeof id === 'string') {
      mockCorrelationsMap.delete(id);
    }
    return HttpResponse.json(data);
  });

export const editCorrelationsHandler = (data: UpdateCorrelationApiResponse) =>
  http.patch('/apis/correlations.grafana.app/v0alpha1/namespaces/:namespace/correlations/:id', ({ params }) => {
    const { id } = params;
    if (id !== undefined && typeof id === 'string') {
      const existingCorr = mockCorrelationsMap.get(id);
      if (existingCorr !== undefined) {
        const updatedCorr = { ...existingCorr, ...data };
        mockCorrelationsMap.set(id, updatedCorr);
      }
    }
    return HttpResponse.json(data);
  });
