import { HttpResponse, delay, http } from 'msw';

import {
  PromRulesResponse,
  RulerRuleGroupDTO,
  RulerRulesConfigDTO,
} from '../../../../../../types/unified-alerting-dto';
import { namespaces } from '../../mimirRulerApi';
import { HandlerOptions } from '../configure';

export const getRulerRulesHandler = () => {
  return http.get(`/api/ruler/:dataSourceUID/api/v1/rules`, async () => {
    return HttpResponse.json<RulerRulesConfigDTO>(namespaces);
  });
};

export const prometheusRulesHandler = () => {
  return http.get('/api/prometheus/:dataSourceUID/api/v1/rules', () => {
    return HttpResponse.json<PromRulesResponse>({ status: 'success', data: { groups: [] } });
  });
};

export const updateRulerRuleNamespaceHandler = (options?: HandlerOptions) => {
  return http.post<{ namespaceName: string }>(`/api/ruler/:dataSourceUID/api/v1/rules/:namespaceName`, async () => {
    if (options?.delay !== undefined) {
      await delay(options.delay);
    }

    if (options?.response) {
      return options.response;
    }

    return HttpResponse.json({
      status: 'success',
      error: '',
      errorType: '',
      data: null,
    });
  });
};

export const rulerRuleGroupHandler = (options?: HandlerOptions) => {
  return http.get<{ namespaceName: string; groupName: string }>(
    `/api/ruler/:dataSourceUID/api/v1/rules/:namespaceName/:groupName`,
    ({ params: { namespaceName, groupName } }) => {
      if (options?.response) {
        return options.response;
      }

      const namespace = namespaces[namespaceName];
      if (!namespace) {
        return HttpResponse.json({ message: 'group does not exist\n' }, { status: 404 });
      }

      const matchingGroup = namespace.find((group) => group.name === groupName);
      return HttpResponse.json<RulerRuleGroupDTO>({
        name: groupName,
        interval: matchingGroup?.interval,
        rules: matchingGroup?.rules ?? [],
      });
    }
  );
};

export const deleteRulerRuleGroupHandler = () => {
  return http.delete<{ namespaceName: string; groupName: string }>(
    `/api/ruler/:dataSourceUID/api/v1/rules/:namespaceName/:groupName`,
    ({ params: { namespaceName } }) => {
      const namespace = namespaces[namespaceName];
      if (!namespace) {
        return HttpResponse.json({ message: 'group does not exist\n' }, { status: 404 });
      }

      return HttpResponse.json(
        {
          message: 'Rules deleted',
        },
        { status: 202 }
      );
    }
  );
};

const handlers = [
  getRulerRulesHandler(),
  prometheusRulesHandler(),
  updateRulerRuleNamespaceHandler(),
  rulerRuleGroupHandler(),
  deleteRulerRuleGroupHandler(),
];

export default handlers;
