import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface TeamConfig {
  name: string;
  adoption_date: string;
  file_patterns?: string[];
  area_labels: string[];
  slack_channels: {
    pr: string;
    fr: string;
  };
  enabled: {
    pr_notify: boolean;
    pr_weekly: boolean;
    fr_notify: boolean;
    fr_weekly: boolean;
  };
}

export interface Config {
  teams: TeamConfig[];
}

export interface FeatureRequest {
  number: number;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  labels: string[];
  thumbs_up: number;
  comments: number;
}

export interface PullRequest {
  number: number;
  title: string;
  author: { login: string };
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  files: { path: string }[];
  labels: { name: string }[];
  reviewDecision: string | null;
}

export interface Cluster {
  name: string;
  issue_numbers: number[];
}

export interface PRCluster {
  name: string;
  pr_numbers: number[];
}

export interface ClusterResult {
  clusters: Cluster[];
}

export interface PRClusterResult {
  clusters: PRCluster[];
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
  elements?: { type: string; text: string }[];
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG_FILE = '.github/team-notifications-config.json';
export function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) {
    log.error(`Configuration file not found: ${CONFIG_FILE}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Config;
}

// =============================================================================
// ENVIRONMENT HELPERS
// =============================================================================
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    log.error(`Required environment variable ${name} is not set`);
    process.exit(1);
  }
  return value;
}

// =============================================================================
// GITHUB ACTIONS LOGGING
// =============================================================================

export const log = {
  notice: (msg: string) => console.log(`::notice::${msg}`),
  warning: (msg: string) => console.log(`::warning::${msg}`),
  error: (msg: string) => console.log(`::error::${msg}`),
  groupStart: (name: string) => console.log(`::group::${name}`),
  groupEnd: () => console.log('::endgroup::'),
};

// =============================================================================
// GITHUB ACTIONS OUTPUT
// =============================================================================
export function setOutput(key: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  const safeValue = value.replace(/[\r\n]/g, '');
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${safeValue}\n`);
  }
  console.log(`Output: ${key}=${safeValue}`);
}

export function setOutputMultiline(key: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    const delimiter = `ghadelim_${crypto.randomUUID().replace(/-/g, '')}`;
    appendFileSync(outputFile, `${key}<<${delimiter}\n${value}\n${delimiter}\n`);
  }
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================
export function sanitizeInput(input: string, maxLength: number = 200): string {
  if (!input) return '';

  let s = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  s = s.replace(
    /(ignore|disregard|forget|override|bypass|skip|new instruction|system:|assistant:|user:)\s*(all|any|the|previous|above|prior|my)?\s*(instruction|command|rule|prompt|message|context)s?/gi,
    '',
  );

  s = s.replace(/```/g, '');
  s = s.replace(/\s+/g, ' ').trim();

  return s.slice(0, maxLength);
}

export function sanitizeForSlack(text: string): string {
  return text
    .replace(/@channel/gi, '')
    .replace(/@here/gi, '')
    .replace(/@everyone/gi, '')
    .replace(/@all/gi, '')
    .replace(/<!channel>/gi, '')
    .replace(/<!here>/gi, '')
    .replace(/<!everyone>/gi, '')
    .replace(/<@[A-Z0-9]+>/gi, '')
    .replace(/<![a-z]+\|[^>]*>/gi, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function isValidIssueNumber(num: unknown): num is number {
  return typeof num === 'number' && Number.isInteger(num) && num > 0 && num < 1_000_000_000;
}

export function isValidGitHubUsername(username: string): boolean {
  return /^[a-zA-Z0-9-]{1,39}$/.test(username);
}

export function validateFRClusterResponse(response: string): ClusterResult {
  const empty: ClusterResult = { clusters: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(response);
  } catch {
    return empty;
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Record<string, unknown>).clusters)) {
    return empty;
  }

  const clusters: Cluster[] = [];
  for (const raw of (parsed as { clusters: unknown[] }).clusters) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const name = String(entry.name ?? 'Unnamed cluster').replace(/[\x00-\x1F]/g, '').slice(0, 100);
    const issueNumbers: number[] = Array.isArray(entry.issue_numbers)
      ? entry.issue_numbers.filter(isValidIssueNumber)
      : [];
    if (issueNumbers.length >= 2) {
      clusters.push({ name, issue_numbers: issueNumbers });
    }
  }

  return { clusters };
}

export function validatePRClusterResponse(response: string): PRClusterResult {
  const empty: PRClusterResult = { clusters: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(response);
  } catch {
    return empty;
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Record<string, unknown>).clusters)) {
    return empty;
  }

  const clusters: PRCluster[] = [];
  for (const raw of (parsed as { clusters: unknown[] }).clusters) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const name = String(entry.name ?? 'Unnamed cluster').replace(/[\x00-\x1F]/g, '').slice(0, 100);
    const prNumbers: number[] = Array.isArray(entry.pr_numbers)
      ? entry.pr_numbers.filter((n): n is number => typeof n === 'number' && n > 0 && n < 1_000_000)
      : [];
    if (prNumbers.length >= 2) {
      clusters.push({ name, pr_numbers: prNumbers });
    }
  }

  return { clusters };
}

// =============================================================================
// GITHUB CLI HELPERS
// =============================================================================
export function ghExec(args: string[], timeoutMs: number = 30_000): string {
  return execFileSync('gh', args, { encoding: 'utf-8', timeout: timeoutMs });
}

export function ghGraphQL(query: string, variables: Record<string, string | number>): unknown {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'number') {
      args.push('-F', `${key}=${value}`);
    } else {
      args.push('-f', `${key}=${value}`);
    }
  }
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf-8', timeout: 30_000 }));
}

// =============================================================================
// GLOB PATTERN MATCHING
// =============================================================================
export function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*');
  return new RegExp(`^${escaped}`);
}

// =============================================================================
// SLACK HELPERS
// =============================================================================
export async function sendSlackMessage(
  token: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const body = (await response.json()) as Record<string, unknown>;

    if (response.ok && body.ok === true) {
      return true;
    }

    log.warning(`Slack API error: ${(body.error as string) ?? 'unknown'} (HTTP ${response.status})`);
    console.log(JSON.stringify(body, null, 2));
    return false;
  } catch (err) {
    log.error(`Slack request failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// =============================================================================
// OPENAI HELPERS
// =============================================================================

interface OpenAIMessage {
  role: 'system' | 'user';
  content: string;
}

interface OpenAIOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}

export async function callOpenAI(
  apiKey: string,
  messages: OpenAIMessage[],
  options: OpenAIOptions = {},
): Promise<string> {
  const {
    model = 'gpt-4o-mini',
    maxTokens = 1500,
    temperature = 0.3,
    jsonMode = false,
    timeoutMs = 30_000,
  } = options;

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  if (jsonMode) {
    requestBody.response_format = { type: 'json_object' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      log.warning(`OpenAI API returned ${response.status}`);
      return '';
    }

    const body = (await response.json()) as Record<string, unknown>;
    const choices = body.choices as { message?: { content?: string } }[] | undefined;
    return choices?.[0]?.message?.content ?? '';
  } catch (err) {
    log.warning(`OpenAI API call failed: ${err instanceof Error ? err.message : String(err)}`);
    return '';
  }
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

export function issueLink(repo: string, number: number): string {
  return `<https://github.com/${repo}/issues/${number}|#${number}>`;
}

export function prLink(repo: string, number: number): string {
  return `<https://github.com/${repo}/pull/${number}|#${number}>`;
}

export function buildLinks(
  numbers: number[],
  linkFn: (num: number) => string,
  maxItems: number = 20,
  overflowUrl?: string,
): string {
  const displayed = numbers.slice(0, maxItems);
  const links = displayed.map(linkFn).join(', ');

  if (numbers.length > maxItems && overflowUrl) {
    return `${links} <${overflowUrl}|View ${numbers.length - maxItems} more>`;
  }
  return links;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
