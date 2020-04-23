export type ZipkinSpan = {
  traceId: string;
  parentId: string;
  name: string;
  id: string;
  timestamp: number;
  duration: number;
  localEndpoint: {
    serviceName: string;
    ipv4: string;
    port: number;
  };
  annotations: ZipkinAnnotation[];
  tags?: { [key: string]: string };
  kind: string;
};

export type ZipkinAnnotation = {
  timestamp: number;
  value: string;
};
