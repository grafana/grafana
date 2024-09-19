export type OtelResponse = {
  data: {
    result: [
      {
        metric: {
          job: string;
          instance: string;
        };
      },
    ];
  };
  status: 'success' | 'error';
  error?: 'string';
  warnings?: string[];
};

export type LabelResponse = {
  data: string[];
  status: 'success' | 'error';
  error?: 'string';
  warnings?: string[];
};

export type OtelTargetType = {
  jobs: string[];
  instances: string[];
};

export type OtelResourcesObject = {
  filters: string;
  labels: string;
};
