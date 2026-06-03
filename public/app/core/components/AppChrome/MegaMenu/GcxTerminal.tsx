import { css, keyframes } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getBackendSrv, locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import grotIcon from 'img/grot-news.svg';

interface Props {
  onClose?: () => void;
}

type LineKind = 'system' | 'command' | 'output' | 'error' | 'accent' | 'dim';

interface TerminalLine {
  id: number;
  kind: LineKind;
  text: string;
}

interface GcxResult {
  lines: Array<{ kind: LineKind; text: string }>;
  clear?: boolean;
  close?: boolean;
}

const PROMPT = 'gcx \u276f';

const BOOT_LINES = [
  'gcx :: grafana command experience',
  '',
  'initializing neon core ............ ok',
  'summoning grot the cat ............ ok',
  'connecting to grafana api ......... ok',
  '',
  "type 'help' for commands. type 'grot' to pet the cat.",
];

const HELP = [
  'gcx - grafana command experience  (the "gcx" prefix is optional)',
  '',
  '  folder create "<title>"          create a folder',
  '  folder ls                        list folders',
  '  dashboard create "<title>" [--folder "<name>"] [--panel "<title>"]',
  '  dashboard ls [<query>]           list dashboards',
  '  dashboard open "<name>"          open a dashboard',
  '  panel add "<dash>" --title "<t>" [--expr "<promql>"] [--datasource "<uid>"]',
  '  threshold set "<dash>" <value> [--panel <id>]',
  '  variable add "<dash>" --name <n> [--type custom|query] [--values "a,b,c"]',
  '  datasource ls                    list data sources',
  '  goto <home|dashboards|explore|alerting|...>   jump to a page',
  '  whoami                           current user',
  '  version                          build info',
  '',
  '  grot   pet the cat     clear   wipe screen     exit   close terminal',
];

const GROT_ART = ['   /\\_/\\', '  ( ^.^ )   grot online. neon levels: maximum.', '   > ~ <'];

interface FolderDTO {
  uid: string;
  title: string;
  url?: string;
}

interface SearchHit {
  uid: string;
  title: string;
  type: string;
}

interface DataSourceDTO {
  uid: string;
  name: string;
  type: string;
}

interface UserDTO {
  login: string;
  email?: string;
  name?: string;
}

interface DashboardPanel {
  id?: number;
  type?: string;
  title?: string;
  gridPos?: { x: number; y: number; w: number; h: number };
  datasource?: { uid: string };
  targets?: unknown[];
  fieldConfig?: { defaults?: Record<string, unknown>; overrides?: unknown[] };
  options?: Record<string, unknown>;
}

interface DashboardModel {
  uid?: string;
  title: string;
  schemaVersion?: number;
  editable?: boolean;
  panels?: DashboardPanel[];
  [key: string]: unknown;
}

interface DashboardResponse {
  dashboard: DashboardModel;
  meta?: { folderUid?: string; url?: string };
}

const GOTO_TARGETS: Record<string, string> = {
  home: '/',
  dashboards: '/dashboards',
  explore: '/explore',
  alerting: '/alerting',
  connections: '/connections',
  admin: '/admin',
  administration: '/admin',
  profile: '/profile',
};

interface SaveResponse {
  uid: string;
  url: string;
}

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string>;
}

const mkLines = (kind: LineKind, ...text: string[]): GcxResult => ({
  lines: text.map((value) => ({ kind, text: value })),
});

const pad = (value: string, width: number): string =>
  value.length >= width ? `${value} ` : value + ' '.repeat(width - value.length);

function errorToString(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object') {
    if (
      'data' in err &&
      err.data &&
      typeof err.data === 'object' &&
      'message' in err.data &&
      typeof err.data.message === 'string'
    ) {
      return err.data.message;
    }
    if ('message' in err && typeof err.message === 'string') {
      return err.message;
    }
    if ('statusText' in err && typeof err.statusText === 'string') {
      return err.statusText;
    }
  }
  return 'request failed';
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match = re.exec(input);
  while (match !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
    match = re.exec(input);
  }
  return tokens;
}

function parseArgs(tokens: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    } else {
      positionals.push(token);
    }
  }
  return { positionals, flags };
}

function makePanel(id: number, y: number, title: string, expr?: string, datasource?: string): DashboardPanel {
  return {
    id,
    type: 'timeseries',
    title,
    gridPos: { x: 0, y, w: 24, h: 9 },
    datasource: datasource ? { uid: datasource } : undefined,
    targets: expr ? [{ refId: 'A', expr, ...(datasource ? { datasource: { uid: datasource } } : {}) }] : [],
    fieldConfig: { defaults: {}, overrides: [] },
    options: {},
  };
}

async function resolveFolderUid(ref: string): Promise<string | undefined> {
  const folders = await getBackendSrv().get<FolderDTO[]>('/api/folders', { limit: 1000 });
  return folders.find((folder) => folder.uid === ref || folder.title === ref)?.uid;
}

async function resolveDashboard(ref: string): Promise<DashboardResponse | undefined> {
  try {
    return await getBackendSrv().get<DashboardResponse>(`/api/dashboards/uid/${encodeURIComponent(ref)}`);
  } catch {
    const hits = await getBackendSrv().get<SearchHit[]>('/api/search', { query: ref, type: 'dash-db', limit: 100 });
    const hit = hits.find((item) => item.title === ref) ?? hits[0];
    return hit
      ? getBackendSrv().get<DashboardResponse>(`/api/dashboards/uid/${encodeURIComponent(hit.uid)}`)
      : undefined;
  }
}

async function runGcx(raw: string, canClose: boolean): Promise<GcxResult> {
  let tokens = tokenize(raw.trim());
  if (tokens.length === 0) {
    return { lines: [] };
  }
  // the "gcx" prefix is optional - drop it if the user typed it
  if (tokens[0].toLowerCase() === 'gcx') {
    tokens = tokens.slice(1);
  }
  if (tokens.length === 0) {
    return mkLines('output', ...HELP);
  }
  const lower = tokens.map((token) => token.toLowerCase());
  const cmd = lower[0];

  if (cmd === 'clear' || cmd === 'cls') {
    return { lines: [], clear: true };
  }
  if (cmd === 'grot' || cmd === 'cat') {
    return mkLines('accent', ...GROT_ART);
  }
  if (cmd === 'sudo') {
    return mkLines('error', 'nice try. the cat has root, not you.');
  }
  if (cmd === 'exit' || cmd === 'quit') {
    return canClose
      ? { lines: [{ kind: 'system', text: 'powering down neon core ...' }], close: true }
      : mkLines('error', 'cannot exit while docked. undock from the top bar.');
  }
  if (cmd === 'help') {
    return mkLines('output', ...HELP);
  }

  const sub = cmd;
  const action = lower[1];
  const { positionals, flags } = parseArgs(tokens.slice(2));

  try {
    switch (sub) {
      case 'version':
        return mkLines('accent', `gcx 1.0.0  -  grafana ${config.buildInfo.version} (${config.buildInfo.edition})`);
      case 'whoami': {
        const user = await getBackendSrv().get<UserDTO>('/api/user');
        const extra = [user.email, user.name ? `(${user.name})` : ''].filter(Boolean).join('  ');
        return mkLines('output', extra ? `${user.login}  ${extra}` : user.login);
      }
      case 'folder':
        return await runFolder(action, positionals);
      case 'dashboard':
      case 'dash':
        return await runDashboard(action, positionals, flags);
      case 'datasource':
      case 'datasources':
      case 'ds':
        return await runDatasource(action);
      case 'panel':
        return await runPanel(action, positionals, flags);
      case 'threshold':
        return await runThreshold(action, positionals, flags);
      case 'variable':
      case 'var':
        return await runVariable(action, positionals, flags);
      case 'goto':
      case 'open':
        return runGoto(tokens[1]);
      default:
        return mkLines('error', `gcx: command not found: ${sub}. try 'help'.`);
    }
  } catch (err) {
    return mkLines('error', `gcx: ${errorToString(err)}`);
  }
}

async function runFolder(action: string | undefined, positionals: string[]): Promise<GcxResult> {
  if (action === 'create' || action === 'new' || action === 'add') {
    const title = positionals[0];
    if (!title) {
      return mkLines('error', 'usage: folder create "<title>"');
    }
    const folder = await getBackendSrv().post<FolderDTO>('/api/folders', { title });
    return mkLines('output', `created folder '${folder.title}'`, `uid:  ${folder.uid}`);
  }
  if (action === 'ls' || action === 'list') {
    const folders = await getBackendSrv().get<FolderDTO[]>('/api/folders', { limit: 1000 });
    if (folders.length === 0) {
      return mkLines('dim', '(no folders)');
    }
    return mkLines(
      'output',
      `${pad('UID', 16)}TITLE`,
      ...folders.map((folder) => `${pad(folder.uid, 16)}${folder.title}`)
    );
  }
  return mkLines('error', 'usage: folder <create|ls>');
}

async function runDashboard(
  action: string | undefined,
  positionals: string[],
  flags: Record<string, string>
): Promise<GcxResult> {
  if (action === 'create' || action === 'new' || action === 'add') {
    const title = positionals[0];
    if (!title) {
      return mkLines('error', 'usage: dashboard create "<title>" [--folder "<name>"] [--panel "<title>"]');
    }
    let folderUid: string | undefined;
    if (flags.folder) {
      folderUid = await resolveFolderUid(flags.folder);
      if (!folderUid) {
        return mkLines('error', `folder not found: ${flags.folder}`);
      }
    }
    const dashboard: DashboardModel = {
      title,
      schemaVersion: 39,
      editable: true,
      panels: [makePanel(1, 0, flags.panel || 'New panel', flags.expr, flags.datasource)],
    };
    const saved = await getBackendSrv().post<SaveResponse>('/api/dashboards/db', {
      dashboard,
      folderUid,
      overwrite: false,
    });
    return mkLines('output', `created dashboard '${title}'`, `uid:  ${saved.uid}`, `url:  ${saved.url}`);
  }
  if (action === 'ls' || action === 'list') {
    const hits = await getBackendSrv().get<SearchHit[]>('/api/search', {
      type: 'dash-db',
      query: positionals.join(' '),
      limit: 100,
    });
    if (hits.length === 0) {
      return mkLines('dim', '(no dashboards)');
    }
    return mkLines('output', `${pad('UID', 16)}TITLE`, ...hits.map((hit) => `${pad(hit.uid, 16)}${hit.title}`));
  }
  if (action === 'open' || action === 'go') {
    const ref = positionals[0];
    if (!ref) {
      return mkLines('error', 'usage: dashboard open "<name>"');
    }
    const found = await resolveDashboard(ref);
    if (!found?.meta?.url) {
      return mkLines('error', `dashboard not found: ${ref}`);
    }
    locationService.push(found.meta.url);
    return { lines: [{ kind: 'system', text: `opening '${found.dashboard.title}'` }], close: true };
  }
  return mkLines('error', 'usage: dashboard <create|ls|open>');
}

async function runDatasource(action: string | undefined): Promise<GcxResult> {
  if (action && action !== 'ls' && action !== 'list') {
    return mkLines('error', 'usage: datasource ls');
  }
  const sources = await getBackendSrv().get<DataSourceDTO[]>('/api/datasources');
  if (sources.length === 0) {
    return mkLines('dim', '(no data sources)');
  }
  return mkLines(
    'output',
    `${pad('UID', 16)}${pad('TYPE', 14)}NAME`,
    ...sources.map((ds) => `${pad(ds.uid, 16)}${pad(ds.type, 14)}${ds.name}`)
  );
}

async function runPanel(
  action: string | undefined,
  positionals: string[],
  flags: Record<string, string>
): Promise<GcxResult> {
  if (action !== 'add') {
    return mkLines('error', 'usage: panel add "<dash>" --title "<t>" [--expr "<promql>"] [--datasource "<uid>"]');
  }
  const ref = positionals[0];
  if (!ref) {
    return mkLines('error', 'usage: panel add "<dash>" --title "<t>"');
  }
  const found = await resolveDashboard(ref);
  if (!found) {
    return mkLines('error', `dashboard not found: ${ref}`);
  }
  const model = found.dashboard;
  const panels = model.panels ?? [];
  const nextId = panels.reduce((max, panel) => Math.max(max, panel.id ?? 0), 0) + 1;
  const nextY = panels.reduce((max, panel) => Math.max(max, (panel.gridPos?.y ?? 0) + (panel.gridPos?.h ?? 0)), 0);
  const panel = makePanel(nextId, nextY, flags.title || 'New panel', flags.expr, flags.datasource);
  model.panels = [...panels, panel];
  await getBackendSrv().post('/api/dashboards/db', {
    dashboard: model,
    folderUid: found.meta?.folderUid,
    overwrite: true,
  });
  return mkLines('output', `added panel '${panel.title ?? ''}' to '${model.title}'`);
}

async function runThreshold(
  action: string | undefined,
  positionals: string[],
  flags: Record<string, string>
): Promise<GcxResult> {
  if (action !== 'set') {
    return mkLines('error', 'usage: threshold set "<dash>" <value> [--panel <id>]');
  }
  const ref = positionals[0];
  const value = Number(positionals[1]);
  if (!ref || Number.isNaN(value)) {
    return mkLines('error', 'usage: threshold set "<dash>" <value> [--panel <id>]');
  }
  const found = await resolveDashboard(ref);
  if (!found) {
    return mkLines('error', `dashboard not found: ${ref}`);
  }
  const panels = found.dashboard.panels ?? [];
  if (panels.length === 0) {
    return mkLines('error', 'dashboard has no panels');
  }
  const panel = flags.panel ? panels.find((item) => String(item.id) === flags.panel) : panels[panels.length - 1];
  if (!panel) {
    return mkLines('error', `panel not found: ${flags.panel}`);
  }
  const defaults = panel.fieldConfig?.defaults ?? {};
  const existingCustom = defaults.custom && typeof defaults.custom === 'object' ? defaults.custom : {};
  panel.fieldConfig = {
    defaults: {
      ...defaults,
      thresholds: {
        mode: 'absolute',
        steps: [
          { value: null, color: 'green' },
          { value, color: 'red' },
        ],
      },
      custom: { ...existingCustom, thresholdsStyle: { mode: 'line' } },
    },
    overrides: panel.fieldConfig?.overrides ?? [],
  };
  await getBackendSrv().post('/api/dashboards/db', {
    dashboard: found.dashboard,
    folderUid: found.meta?.folderUid,
    overwrite: true,
  });
  return mkLines('output', `set threshold ${value} on panel '${panel.title ?? panel.id}'`);
}

function runGoto(target: string | undefined): GcxResult {
  if (!target) {
    return mkLines('error', `usage: goto <${Object.keys(GOTO_TARGETS).join('|')}|/path>`);
  }
  const url = target.startsWith('/') ? target : GOTO_TARGETS[target.toLowerCase()];
  if (!url) {
    return mkLines('error', `unknown destination: ${target}`);
  }
  locationService.push(url);
  return { lines: [{ kind: 'system', text: `navigating to ${url}` }], close: true };
}

function getTemplatingList(model: DashboardModel): unknown[] {
  const templating = model.templating;
  if (templating && typeof templating === 'object' && 'list' in templating && Array.isArray(templating.list)) {
    return templating.list;
  }
  return [];
}

function buildVariable(type: 'custom' | 'query', name: string, flags: Record<string, string>): Record<string, unknown> {
  if (type === 'query') {
    return {
      type: 'query',
      name,
      label: name,
      datasource: flags.datasource ? { uid: flags.datasource } : undefined,
      query: flags.query ?? '',
      refresh: 1,
      current: {},
      options: [],
    };
  }
  const values = (flags.values ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const options = values.map((value, index) => ({ text: value, value, selected: index === 0 }));
  return {
    type: 'custom',
    name,
    label: name,
    query: values.join(','),
    current: options[0] ? { text: options[0].text, value: options[0].value } : {},
    options,
    includeAll: false,
    multi: false,
  };
}

async function runVariable(
  action: string | undefined,
  positionals: string[],
  flags: Record<string, string>
): Promise<GcxResult> {
  if (action !== 'add') {
    return mkLines('error', 'usage: variable add "<dash>" --name <name> [--type custom|query] [--values "a,b,c"]');
  }
  const ref = positionals[0];
  const name = flags.name;
  if (!ref || !name) {
    return mkLines('error', 'usage: variable add "<dash>" --name <name> [--type custom|query] [--values "a,b,c"]');
  }
  const found = await resolveDashboard(ref);
  if (!found) {
    return mkLines('error', `dashboard not found: ${ref}`);
  }
  const model = found.dashboard;
  const type = flags.type === 'query' ? 'query' : 'custom';
  const variable = buildVariable(type, name, flags);
  const existing = getTemplatingList(model).filter(
    (item) => !(item && typeof item === 'object' && 'name' in item && item.name === name)
  );
  model.templating = { list: [...existing, variable] };
  await getBackendSrv().post('/api/dashboards/db', {
    dashboard: model,
    folderUid: found.meta?.folderUid,
    overwrite: true,
  });
  return mkLines('output', `added ${type} variable '${name}' to '${model.title}'`);
}

/**
 * A neon "gcx" terminal that replaces the navigation menu when the
 * simplifiedNavigation flag is on. It boots with a wiggling Grot cat and runs a
 * small set of real commands against the Grafana HTTP API via getBackendSrv.
 */
export function GcxTerminal({ onClose }: Props) {
  const styles = useStyles2(getStyles);
  const [booting, setBooting] = useState(true);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const idRef = useRef(0);
  const mountedRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nextId = () => ++idRef.current;
  const append = (incoming: Array<{ kind: LineKind; text: string }>) =>
    setLines((prev) => [...prev, ...incoming.map((line) => ({ ...line, id: nextId() }))]);

  // boot sequence: stream the boot log, then hand over to the prompt
  useEffect(() => {
    const timers: number[] = [];
    BOOT_LINES.forEach((text, i) => {
      timers.push(
        window.setTimeout(
          () => {
            setLines((prev) => [...prev, { id: nextId(), kind: 'system', text }]);
            if (i === BOOT_LINES.length - 1) {
              setBooting(false);
            }
          },
          160 * (i + 1)
        )
      );
    });
    return () => timers.forEach((id) => clearTimeout(id));
  }, []);

  // keep the latest line in view and focus the prompt once booted
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    if (!booting && !busy) {
      inputRef.current?.focus();
    }
  }, [booting, busy]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const submit = async () => {
    const raw = input;
    setInput('');
    setHistoryIndex(null);
    append([{ kind: 'command', text: `${PROMPT} ${raw}` }]);

    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    setHistory((prev) => [...prev, trimmed]);

    setBusy(true);
    let result: GcxResult;
    try {
      result = await runGcx(raw, Boolean(onClose));
    } catch (err) {
      result = { lines: [{ kind: 'error', text: `gcx: ${errorToString(err)}` }] };
    }
    if (!mountedRef.current) {
      return;
    }
    setBusy(false);
    if (result.clear) {
      setLines([]);
      return;
    }
    if (result.lines.length) {
      append(result.lines);
    }
    if (result.close && onClose) {
      window.setTimeout(() => onClose(), 500);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!history.length) {
        return;
      }
      const index = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(index);
      setInput(history[index]);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex === null) {
        return;
      }
      const index = historyIndex + 1;
      if (index >= history.length) {
        setHistoryIndex(null);
        setInput('');
      } else {
        setHistoryIndex(index);
        setInput(history[index]);
      }
    }
  };

  return (
    <div className={styles.terminal} data-testid="gcx-terminal">
      <div className={styles.scanlines} aria-hidden />
      <div className={styles.banner}>
        <div className={styles.rainbow} aria-hidden />
        <img
          className={booting ? styles.mascotBooting : styles.mascot}
          src={grotIcon}
          alt={t('navigation.gcx.mascot-alt', 'Grot')}
        />
      </div>

      <div className={styles.scrollback} role="log" aria-live="polite" ref={scrollRef}>
        {lines.map((line) => (
          <div key={line.id} className={styles[line.kind]}>
            {line.text || '\u00a0'}
          </div>
        ))}
        {booting && <div className={styles.cursorLine}>{t('navigation.gcx.booting', 'booting gcx')}</div>}
      </div>

      {!booting && (
        <div className={styles.inputRow}>
          <span className={styles.prompt}>{PROMPT}</span>
          <input
            ref={inputRef}
            className={styles.input}
            value={input}
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-label={t('navigation.gcx.input-aria', 'gcx command input')}
            onChange={(event) => setInput(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      )}
    </div>
  );
}

GcxTerminal.displayName = 'GcxTerminal';

const flicker = keyframes({
  '0%, 100%': { opacity: 1 },
  '92%': { opacity: 1 },
  '94%': { opacity: 0.6 },
  '96%': { opacity: 1 },
});

// bob + tail-wiggle in a single keyframe so the transforms don't fight
const wiggle = keyframes({
  '0%': { transform: 'translateY(0) rotate(-4deg)' },
  '25%': { transform: 'translateY(-5px) rotate(3deg)' },
  '50%': { transform: 'translateY(-1px) rotate(-3deg)' },
  '75%': { transform: 'translateY(-5px) rotate(4deg)' },
  '100%': { transform: 'translateY(0) rotate(-4deg)' },
});

// the classic neon-cat rainbow trail streaming past
const stream = keyframes({
  '0%': { backgroundPosition: '0 0, 0 0' },
  '100%': { backgroundPosition: '-18px 0, 0 0' },
});

const blink = keyframes({
  '0%, 49%': { opacity: 1 },
  '50%, 100%': { opacity: 0 },
});

const NEON_GREEN = '#39ff14';
const NEON_CYAN = '#36e2ff';
const NEON_PINK = '#ff4dfd';
const NEON_DIM = '#3b6b58';

const getStyles = (theme: GrafanaTheme2) => {
  const mono = theme.typography.fontFamilyMonospace;
  return {
    terminal: css({
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      background: 'radial-gradient(circle at 50% 0%, #0a0f1f 0%, #04060d 70%)',
      fontFamily: mono,
      fontSize: '12px',
      lineHeight: 1.5,
      cursor: 'text',
    }),
    scanlines: css({
      pointerEvents: 'none',
      position: 'absolute',
      inset: 0,
      zIndex: 2,
      background: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.18) 3px)',
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${flicker} 6s infinite`,
      },
    }),
    banner: css({
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      minHeight: 84,
      padding: theme.spacing(1, 1, 0, 1),
      overflow: 'hidden',
    }),
    rainbow: css({
      position: 'absolute',
      top: '50%',
      right: 'calc(50% + 14px)',
      transform: 'translateY(-50%)',
      width: 72,
      height: 44,
      zIndex: 0,
      borderRadius: theme.shape.radius.default,
      opacity: 0.85,
      filter: 'drop-shadow(0 0 10px rgba(255,77,253,0.55))',
      background: `repeating-linear-gradient(90deg, rgba(0,0,0,0.25) 0 9px, rgba(0,0,0,0) 9px 18px), linear-gradient(180deg, #ff3b3b 0 16.66%, #ff9f1c 16.66% 33.33%, #ffe600 33.33% 50%, #3bff6b 50% 66.66%, #36e2ff 66.66% 83.33%, #b14dff 83.33% 100%)`,
      backgroundSize: '18px 100%, 100% 100%',
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${stream} 0.45s linear infinite`,
      },
    }),
    mascot: css({
      position: 'relative',
      zIndex: 1,
      height: 64,
      objectFit: 'contain',
      filter: 'drop-shadow(0 0 6px rgba(54,226,255,0.6))',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'height 0.4s ease',
        animation: `${wiggle} 0.8s ease-in-out infinite`,
      },
    }),
    mascotBooting: css({
      position: 'relative',
      zIndex: 1,
      height: 132,
      objectFit: 'contain',
      filter: 'drop-shadow(0 0 14px rgba(255,79,253,0.7))',
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${wiggle} 1s ease-in-out infinite`,
      },
    }),
    scrollback: css({
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: theme.spacing(1, 1.5),
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }),
    inputRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      flexShrink: 0,
      padding: theme.spacing(1, 1.5, 1.5, 1.5),
      borderTop: `1px solid rgba(54,226,255,0.25)`,
    }),
    prompt: css({
      color: NEON_CYAN,
      textShadow: `0 0 6px ${NEON_CYAN}`,
      whiteSpace: 'nowrap',
    }),
    input: css({
      flex: 1,
      minWidth: 0,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: NEON_GREEN,
      caretColor: NEON_GREEN,
      fontFamily: mono,
      fontSize: '12px',
      textShadow: `0 0 6px rgba(57,255,20,0.6)`,
    }),
    system: css({ color: NEON_CYAN, textShadow: `0 0 4px rgba(54,226,255,0.5)` }),
    command: css({ color: '#dfe7ff', textShadow: '0 0 4px rgba(223,231,255,0.4)' }),
    output: css({ color: NEON_GREEN, textShadow: `0 0 4px rgba(57,255,20,0.45)` }),
    accent: css({ color: NEON_PINK, textShadow: `0 0 6px rgba(255,79,253,0.6)` }),
    error: css({ color: '#ff5d6c', textShadow: '0 0 6px rgba(255,93,108,0.6)' }),
    dim: css({ color: NEON_DIM }),
    cursorLine: css({
      color: NEON_GREEN,
      textShadow: `0 0 6px rgba(57,255,20,0.6)`,
      '&::after': {
        content: '"\\2588"',
        marginLeft: 2,
        [theme.transitions.handleMotion('no-preference')]: {
          animation: `${blink} 1s steps(1) infinite`,
        },
      },
    }),
  };
};
