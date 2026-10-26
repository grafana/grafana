import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';

import { type ResourceRef, groupResourceOf } from './api/globalSearchApi';

export interface KindInfo {
  label: () => string;
  /** For tabs, group headers and "View all" links. */
  plural: () => string;
  icon: IconName;
  /** A theme visualization color name. Unset uses the secondary text color. */
  color?: string;
  /** How the stars API stores this type. Unset means the type can't be starred. */
  star?: { group: string; kind: string };
  /** In-app path to open one resource. Unset means there's nowhere to send the user. */
  url?: (name: string) => string;
  /** In-app path to create one, in the given folder when the page supports it. */
  createUrl?: (folderUID?: string) => string;
  /** Lives in a folder through the `grafana.app/folder` annotation, so it can be moved. */
  supportsFolders: boolean;
}

const ASSISTANT = '/a/grafana-assistant-app';

const KINDS: Record<string, KindInfo> = {
  'dashboard.grafana.app/dashboards': {
    label: () => t('urv.kinds.dashboard', 'Dashboard'),
    plural: () => t('urv.kinds.dashboards', 'Dashboards'),
    icon: 'apps',
    color: 'orange',
    star: { group: 'dashboard.grafana.app', kind: 'Dashboard' },
    url: (name) => `/d/${encodeURIComponent(name)}`,
    createUrl: (folderUID) =>
      folderUID ? `/dashboard/new?folderUid=${encodeURIComponent(folderUID)}` : '/dashboard/new',
    supportsFolders: true,
  },
  'folder.grafana.app/folders': {
    label: () => t('urv.kinds.folder', 'Folder'),
    plural: () => t('urv.kinds.folders', 'Folders'),
    icon: 'folder',
    color: 'blue',
    star: { group: 'folder.grafana.app', kind: 'Folder' },
    url: (name) => `/dashboards/f/${encodeURIComponent(name)}`,
    supportsFolders: true,
  },
  'rules.alerting.grafana.app/alertrules': {
    label: () => t('urv.kinds.alert-rule', 'Alert rule'),
    plural: () => t('urv.kinds.alert-rules', 'Alert rules'),
    icon: 'bell',
    color: 'red',
    star: { group: 'rules.alerting.grafana.app', kind: 'AlertRule' },
    url: (name) => `/alerting/grafana/${encodeURIComponent(name)}/view`,
    createUrl: () => '/alerting/new/alerting',
    supportsFolders: true,
  },
  'rules.alerting.grafana.app/recordingrules': {
    label: () => t('urv.kinds.recording-rule', 'Recording rule'),
    plural: () => t('urv.kinds.recording-rules', 'Recording rules'),
    icon: 'record-audio',
    color: 'red',
    star: { group: 'rules.alerting.grafana.app', kind: 'RecordingRule' },
    url: (name) => `/alerting/grafana/${encodeURIComponent(name)}/view`,
    createUrl: () => '/alerting/new/recording',
    supportsFolders: true,
  },
  'dashboard.grafana.app/notebooks': {
    label: () => t('urv.kinds.notebook', 'Notebook'),
    plural: () => t('urv.kinds.notebooks', 'Notebooks'),
    icon: 'book-open',
    color: 'purple',
    star: { group: 'dashboard.grafana.app', kind: 'Notebook' },
    url: (name) => `/notebooks/${encodeURIComponent(name)}`,
    createUrl: () => '/notebooks/new',
    supportsFolders: true,
  },
  'playlist.grafana.app/playlists': {
    label: () => t('urv.kinds.playlist', 'Playlist'),
    plural: () => t('urv.kinds.playlists', 'Playlists'),
    icon: 'presentation-play',
    color: 'yellow',
    star: { group: 'playlist.grafana.app', kind: 'Playlist' },
    url: (name) => `/playlists/edit/${encodeURIComponent(name)}`,
    createUrl: () => '/playlists/new',
    supportsFolders: false,
  },
  'dashboard.grafana.app/variables': {
    label: () => t('urv.kinds.variable', 'Variable'),
    plural: () => t('urv.kinds.variables', 'Variables'),
    icon: 'brackets-curly',
    color: 'blue',
    star: { group: 'dashboard.grafana.app', kind: 'Variable' },
    url: (name) => `/dashboards/variables/edit/${encodeURIComponent(name)}`,
    createUrl: () => '/dashboards/variables/new',
    supportsFolders: true,
  },
  'assistant.ext.grafana.app/pages': {
    label: () => t('urv.kinds.assistant-page', 'Assistant page'),
    plural: () => t('urv.kinds.assistant-pages', 'Assistant pages'),
    icon: 'file-alt',
    color: 'purple',
    star: { group: 'assistant.ext.grafana.app', kind: 'Page' },
    url: (name) => `${ASSISTANT}/pages/${encodeURIComponent(name)}`,
    supportsFolders: true,
  },
  'assistant.ext.grafana.app/rules': {
    label: () => t('urv.kinds.assistant-rule', 'Assistant rule'),
    plural: () => t('urv.kinds.assistant-rules', 'Assistant rules'),
    icon: 'list-ul',
    color: 'blue',
    star: { group: 'assistant.ext.grafana.app', kind: 'Rule' },
    url: () => `${ASSISTANT}/settings`,
    supportsFolders: true,
  },
  'assistant.ext.grafana.app/skills': {
    label: () => t('urv.kinds.assistant-skill', 'Assistant skill'),
    plural: () => t('urv.kinds.assistant-skills', 'Assistant skills'),
    icon: 'ai',
    color: 'green',
    star: { group: 'assistant.ext.grafana.app', kind: 'Skill' },
    url: () => `${ASSISTANT}/settings`,
    supportsFolders: true,
  },
  'assistant.ext.grafana.app/quickstartprompts': {
    label: () => t('urv.kinds.assistant-quickstart', 'Quickstart prompt'),
    plural: () => t('urv.kinds.assistant-quickstarts', 'Quickstart prompts'),
    icon: 'comment-alt',
    color: 'yellow',
    star: { group: 'assistant.ext.grafana.app', kind: 'QuickstartPrompt' },
    url: () => `${ASSISTANT}/settings`,
    supportsFolders: true,
  },
  // Types mentioned as coming soon. Listed so they get a label as soon as they opt in.
  'workflows.ext.grafana.app/definitions': {
    label: () => t('urv.kinds.workflow', 'Workflow'),
    plural: () => t('urv.kinds.workflows', 'Workflows'),
    icon: 'sitemap',
    color: 'green',
    supportsFolders: true,
  },
  'investigations.grafana.app/investigations': {
    label: () => t('urv.kinds.investigation', 'Investigation'),
    plural: () => t('urv.kinds.investigations', 'Investigations'),
    icon: 'search',
    color: 'blue',
    supportsFolders: true,
  },
};

/** Any type the endpoint returns gets listed, even one this page has never heard of. */
export function getKindInfo(ref: Pick<ResourceRef, 'group' | 'resource'>): KindInfo {
  const key = groupResourceOf(ref);
  return (
    KINDS[key] ?? {
      label: () => key,
      plural: () => key,
      icon: 'cube',
      supportsFolders: false,
    }
  );
}

export function kindInfoFor(groupResource: string): KindInfo {
  const [group = '', resource = ''] = groupResource.split('/');
  return getKindInfo({ group, resource });
}

/** Every type this page has a label for, in registry order. */
export function knownKinds(): string[] {
  return Object.keys(KINDS);
}

/** Types that can be created from this page, in registry order. */
export function creatableKinds(): Array<{ groupResource: string; info: KindInfo }> {
  return Object.entries(KINDS)
    .filter(([, info]) => info.createUrl)
    .map(([groupResource, info]) => ({ groupResource, info }));
}

/** The registry entry a star belongs to, so starred names can be searched by type. */
export function groupResourceForStar(group: string, kind: string): string | undefined {
  return Object.entries(KINDS).find(([, info]) => info.star?.group === group && info.star.kind === kind)?.[0];
}
