import { http, HttpResponse } from 'msw';

export const getPrometheusRulesHandler = () => {
  return http.get(`/api/prometheus/:datasourceUid/api/v1/rules`, () => {
    return HttpResponse.json({
      data: { groups: [] },
    });
  });
};

const handlers = [getPrometheusRulesHandler()];
export default handlers;
