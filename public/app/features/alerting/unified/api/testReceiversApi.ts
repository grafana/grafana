import { CreateReceiverTestApiArg, generatedAPI } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

interface TestReceiverIntegrationBody {
  integration: {
    uid?: string;
    type: string;
    version?: string;
    settings: Record<string, unknown>;
    secureFields?: Record<string, boolean>;
    disableResolveMessage?: boolean;
  };
  alert: {
    labels: Record<string, string>;
    annotations: Record<string, string>;
  };
}

export interface CreateReceiverTestOverrideArg extends CreateReceiverTestApiArg {
  body: TestReceiverIntegrationBody;
}

const NEW_RECEIVER_PLACEHOLDER = '-';

// We need to enhance the endpoints to add the correct type for the body
const enhancedApi = generatedAPI.enhanceEndpoints({
  endpoints: {
    createReceiverTest: (endpoint) => {
      endpoint.query = (queryArg: CreateReceiverTestOverrideArg) => ({
        url: `/receivers/${queryArg.name || NEW_RECEIVER_PLACEHOLDER}/test`,
        method: 'POST' as const,
        body: queryArg.body,
      });
    },
  },
});

type OriginalHookResult = ReturnType<typeof enhancedApi.useCreateReceiverTestMutation>;
type OriginalTrigger = OriginalHookResult[0];
type MutationState = OriginalHookResult[1];
type OverrideTrigger = (arg: CreateReceiverTestOverrideArg) => ReturnType<OriginalTrigger>;

export function useCreateReceiverTestMutation(): [OverrideTrigger, MutationState] {
  const [originalTrigger, state] = enhancedApi.useCreateReceiverTestMutation();

  // Wrapping trigger to add the correct type for the body
  const trigger = (arg: CreateReceiverTestOverrideArg) => originalTrigger(arg);

  return [trigger, state];
}
