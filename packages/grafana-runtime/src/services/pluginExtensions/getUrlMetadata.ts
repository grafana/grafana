import { UrlMetadata } from '@grafana/data';

export type GetUrlMetadataOptions = {
  url: string;
};

export type GetUrlMetadataResult = Array<{
  pluginId: string;
  metadata: UrlMetadata;
}>;

export type GetUrlMetadata = (options: GetUrlMetadataOptions) => Promise<GetUrlMetadataResult>;

let singleton: GetUrlMetadata | undefined;

export function setGetUrlMetadataHook(hook: GetUrlMetadata): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setGetUrlMetadataHook() function should only be called once, when Grafana is starting.');
  }
  singleton = hook;
}

export async function getUrlMetadata(options: GetUrlMetadataOptions): Promise<GetUrlMetadataResult> {
  if (!singleton) {
    throw new Error('setGetUrlMetadataHook(hook) must be called before using getUrlMetadata().');
  }
  return singleton(options);
}
