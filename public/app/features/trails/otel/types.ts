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

export type LabelResponse = {
  data: string[];
  status: 'success' | 'error';
  error?: 'string';
  warnings?: string[];
};

export type OtelTargetType = {
  job: string;
  instance: string;
};

export type OtelResourcesObject = {
  filters: string;
  labels: string;
};
