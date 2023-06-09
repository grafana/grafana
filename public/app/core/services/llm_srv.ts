import {
  config,
  getBackendSrv,
  DataSourceMetadata,
  LLMChatCompletionsMessage,
  LLMChatCompletionsRequest,
  LLMRelatedMetadataRequest,
  LLMSrv as LLMService,
} from '@grafana/runtime';

interface OpenAIChatCompletionsRequest {
  model: string;
  messages: LLMChatCompletionsMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: object;
  user?: string;
}

export class LLMSrv implements LLMService {
  isEnabled: boolean;

  constructor() {
    this.isEnabled = config.llms?.enabled ?? false;
  }

  async relatedMetadata<M extends string>(request: LLMRelatedMetadataRequest): Promise<DataSourceMetadata<M>> {
    try {
      const response = await getBackendSrv().post('/api/llms/related-metadata', request, {
        headers: { 'Content-Type': 'application/json' },
      });
      return response;
    } catch (_) {
      return {}
    }
  }

  async chatCompletions(request: LLMChatCompletionsRequest): Promise<string> {
    // TODO: handle non-OpenAI providers.
    const openAIRequest: OpenAIChatCompletionsRequest = {
      model: request.model ?? 'gpt-3.5-turbo',
      messages: request.messages,
    };
    const response = await getBackendSrv().post('/api/llms/proxy/openai/v1/chat/completions', openAIRequest, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.choices[0].message.content;
  }
}

export const llmSrv = new LLMSrv();
