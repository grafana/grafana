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

export type LocalPlugin = {
  category: string;
  defaultNavUrl: string;
  enabled: boolean;
  hasUpdate: boolean;
  id: string;
  info: {
    author: {
      name: string;
      url: string;
    };
    build: {};
    description: string;
    links: Array<{
      name: string;
      url: string;
    }>;
    logos: {
      large: string;
      small: string;
    };
    updated: string;
    version: string;
  };
  latestVersion: string;
  name: string;
  pinned: boolean;
  signature: string;
  signatureOrg: string;
  signatureType: string;
  state: string;
  type: string;
  dev: boolean | undefined;
};

export interface Version {
  version: string;
  createdAt: string;
}

export interface PluginDetails {
  remote?: Plugin;
  remoteVersions?: Version[];
  local?: LocalPlugin;
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
