export interface CatalogAppSettings {
  includeEnterprise?: boolean;
}

export type PluginTypeCode = 'app' | 'panel' | 'datasource';

export interface Plugin {
  name: string;
  description: string;
  slug: string;
  orgName: string;
  orgSlug: string;
  signatureType: string;
  version: string;
  status: string;
  popularity: number;
  downloads: number;
  updatedAt: string;
  createdAt: string;
  typeCode: string;
  featured: number;
  readme: string;
  internal: boolean;
  versionSignatureType: string;
  packages: {
    [arch: string]: {
      packageName: string;
      downloadUrl: string;
    };
  };
  links: Array<{
    rel: string;
    href: string;
  }>;
  json: {
    dependencies: {
      grafanaDependency: string;
      grafanaVersion: string;
    };
    info: {
      links: Array<{
        name: string;
        url: string;
      }>;
    };
  };
}

export type Metadata = {
  info: {
    version: string;
    links: Array<{
      name: string;
      url: string;
    }>;
  };
  dev: boolean;
};

export interface Version {
  version: string;
  createdAt: string;
}

export interface PluginDetails {
  remote?: Plugin;
  remoteVersions?: Version[];
  local?: Metadata;
}

export interface Org {
  slug: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  avatar: string;
  avatarUrl: string;
}
