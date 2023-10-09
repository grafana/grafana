export type LLMAppHealthCheck = {
  details: {
    openAI?: boolean;
    vector?: boolean;
    version?: string;
  };
};

export type LLMAppSettings = {
  enabled: boolean;
  info: {
    version: string;
  };
};
