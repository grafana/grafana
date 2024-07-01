import { delay, http, HttpResponse } from 'msw';

export const MOCK_GRAFANA_ALERT_RULE_TITLE = 'Test alert';

import { RulerRuleGroupDTO } from '../../../../../../types/unified-alerting-dto';
import { namespaces } from '../../mimirRulerApi';
import { HandlerOptions } from '../configure';

export const MIMIR_DATASOURCE_UID = 'mimir';
export const MIMIR_GROUP_NAME = 'group-1';
export const MIMIR_NAMESPACE_NAME = 'namespace-1';

export const updateRulerRuleNamespaceHandler = (options?: HandlerOptions) => {
  return http.post<{ namespaceName: string }>(
    `/api/ruler/${MIMIR_DATASOURCE_UID}/api/v1/rules/:namespaceName`,
    async () => {
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
    }
  );
};

export const rulerRuleGroupHandler = (options?: HandlerOptions) => {
  return http.get<{ namespaceName: string; groupName: string }>(
    `/api/ruler/${MIMIR_DATASOURCE_UID}/api/v1/rules/:namespaceName/:groupName`,
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
    `/api/ruler/${MIMIR_DATASOURCE_UID}/api/v1/rules/:namespaceName/:groupName`,
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

const handlers = [updateRulerRuleNamespaceHandler(), rulerRuleGroupHandler(), deleteRulerRuleGroupHandler()];

export default handlers;
