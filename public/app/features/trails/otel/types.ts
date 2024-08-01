export type OtelResponse = {
  data: {
    result: [
      {
        metric: OtelTargetType;
      },
    ];
  };
  status: 'success' | 'error';
  error?: 'string';
  warnings?: string[];
};

export type OtelTargetType = {
  job: string;
  instance: string;
};
