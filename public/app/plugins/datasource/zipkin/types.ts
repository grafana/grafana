export type ZipkinSpan = {
  traceId: string;
  parentId?: string;
  name: string;
  id: string;
  timestamp: number;
  duration: number;
  localEndpoint?: ZipkinEndpoint;
  remoteEndpoint?: ZipkinEndpoint;
  annotations?: ZipkinAnnotation[];
  tags?: { [key: string]: string };
  kind?: 'CLIENT' | 'SERVER' | 'PRODUCER' | 'CONSUMER';
};

export type ZipkinEndpoint = {
  serviceName: string;
  ipv4?: string;
  ipv6?: string;
  port?: number;
};

export type ZipkinAnnotation = {
  timestamp: number;
  value: string;
};
