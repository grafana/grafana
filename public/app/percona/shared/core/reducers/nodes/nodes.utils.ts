import { payloadToCamelCase } from 'app/percona/shared/helpers/payloadToCamelCase';
import { Node, NodeListPayload } from 'app/percona/shared/services/nodes/Nodes.types';

const MAIN_COLUMNS = ['node_id', 'node_name', 'address', 'custom_labels', 'type'];

export const toDbNodesModel = (nodeList: NodeListPayload): Node[] => {
  const result: Node[] = [];

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  (Object.keys(nodeList) as Array<keyof NodeListPayload>).forEach((nodeType) => {
    const nodeParams = nodeList[nodeType];

    nodeParams?.forEach((params) => {
      const extraLabels: Record<string, string> = {};

      Object.entries(params)
        .filter(([field]) => !MAIN_COLUMNS.includes(field))
        .forEach(([key, value]: [string, string]) => {
          if (typeof value !== 'object' || Array.isArray(value)) {
            extraLabels[key] = value;
            // @ts-ignore
            delete params[key];
          }
        });

      const camelCaseParams = payloadToCamelCase(params, ['custom_labels']);
      // @ts-ignore
      delete camelCaseParams['custom_labels'];

      result.push({
        type: nodeType,
        // @ts-ignore
        params: {
          ...camelCaseParams,
          customLabels: { ...params['custom_labels'], ...extraLabels },
        },
      });
    });
  });

  return result;
};
