export enum LLMProvider {
  /**
   * OpenAI's GPT service.
   *
   * See https://platform.openai.com/docs/api-reference.
   */
  OpenAI = 'openai',
}

interface LLMRequestCommonOptions {
  /**
   * The LLM provider to use.
   *
   * OpenAI will be used as a default.
   *
   * @default LLMProvider.OpenAI.
   */
  provider?: LLMProvider;
  /**
   * The model to use.
   *
   * If not specified, the Grafana proxy will choose a suitable default.
   */
  model?: string;
}

export type LLMSystemMessage = 'system';
export type LLMAssistantMessage = 'assistant';
export type LLMUserMessage = 'user';

export interface LLMChatCompletionsMessage {
  role: LLMSystemMessage | LLMAssistantMessage | LLMUserMessage;
  content: string;
}

/**
 * A request to the LLM service to get completions for a given piece of text.
 *
 * @public
 */
export type LLMChatCompletionsRequest = LLMRequestCommonOptions & {
  /**
   * The text to get completions for.
   */
  messages: LLMChatCompletionsMessage[];
};

export type LLMRelatedMetadataRequestTypeDatasource = 'datasource';
export type LLMRelatedMetadataRequestTypeGrafana = 'grafana';

export interface LLMRelatedMetadataRequest {
  type: LLMRelatedMetadataRequestTypeDatasource | LLMRelatedMetadataRequestTypeGrafana;
  datasourceType: string;
  datasourceUid: string;
  text: string;
}

export type DataSourceMetadata<T extends string> = {
  [key in T]?: string[];
}

/**
 * Used to communicate with LLMs via Grafana.
 *
 * The LLM service is available if Grafana has been configured with
 * LLM support. Requests to the LLM service will be proxied through
 * Grafana to the LLM provider, with authentication injected.
 *
 * This is currently behind the `llms` feature toggle.
 */
export interface LLMSrv {
  isEnabled: boolean;
  chatCompletions(request: LLMChatCompletionsRequest): Promise<string>;
  /**
   * Fetches related metadata for a given datasource.
   *
   * This is only available if Grafana has been configured with a
   * vector database ([llms.vector_db] in grafana.ini).
   */
  relatedMetadata<M extends string>(request: LLMRelatedMetadataRequest): Promise<DataSourceMetadata<M>>;
}

let singletonInstance: LLMSrv;

/**
 * Used during startup by Grafana to set the LLMSrv so it is available
 * via {@link getLLMSrv} to the rest of the application.
 *
 * @internal
 */
export const setLLMSrv = (instance: LLMSrv) => {
  if (singletonInstance && process.env.NODE_ENV !== 'test') {
    throw new Error('setLLMSrv() function should only be called once, when Grafana is starting.');
  }
  singletonInstance = instance;
};

/**
 * Used to retrieve the {@link LLMSrv} that can be used to communicate
 * with LLMs via Grafana.
 *
 * @public
 */
export const getLLMSrv = (): LLMSrv => singletonInstance;
