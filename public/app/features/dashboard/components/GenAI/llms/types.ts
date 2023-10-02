export type LLMAppHealthCheck = {
  details: {
    openAI?: boolean;
    vector?: boolean;
    version?: string;
  };
};
