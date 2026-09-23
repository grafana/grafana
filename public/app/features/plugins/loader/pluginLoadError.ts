import { DECOUPLED_PLUGIN_REGEX, PLUGIN_PATH_REGEX } from './constants';

export type PluginLoadErrorType =
  | 'http'
  | 'network'
  | 'load-failed'
  | 'chunk-load'
  | 'evaluation'
  | 'invalid-module'
  | 'angular'
  | 'unknown';

export type HttpStatusSource = 'response' | 'resource-timing' | 'message' | 'none';

export interface PluginLoadErrorInfo {
  errorType: PluginLoadErrorType;
  httpStatusSource: HttpStatusSource;
  httpStatus?: number;
  failedUrl?: string;
  chunkErrorType?: string;
}

const SCRIPT_LOAD_ERROR_REGEX = /^Error loading (\S+?)(?: from \S+)? \(SystemJS Error#3 /;
const FETCH_STATUS_ERROR_REGEX = /^(\d{3}) [^,]*, loading (\S+?)(?: from \S+)? \(SystemJS Error#7 /;
const CONTENT_TYPE_ERROR_REGEX = /^Unknown Content-Type .*, loading (\S+?)(?: from \S+)? \(SystemJS Error#4 /;
const CHUNK_LOAD_ERROR_URL_REGEX = /\((?:error|missing|timeout): (\S+)\)/;

export class PluginAssetFetchError extends Error {
  url: string;
  status?: number;

  constructor(url: string, status?: number, statusText?: string, options?: ErrorOptions) {
    super(status ? `${status} ${statusText ?? ''}, loading ${url}` : `Network error loading ${url}`, options);
    this.name = 'PluginAssetFetchError';
    this.url = url;
    this.status = status;
  }
}

export class PluginLoadError extends Error {
  errorType: PluginLoadErrorType;
  httpStatusSource: HttpStatusSource;
  httpStatus?: number;
  failedUrl?: string;
  chunkErrorType?: string;

  constructor(message: string, { cause, ...info }: PluginLoadErrorInfo & { cause: unknown }) {
    super(message, { cause });
    this.name = 'PluginLoadError';
    this.errorType = info.errorType;
    this.httpStatusSource = info.httpStatusSource;
    this.httpStatus = info.httpStatus;
    this.failedUrl = info.failedUrl;
    this.chunkErrorType = info.chunkErrorType;
  }
}

export function getResourceStatus(url: string): number | undefined {
  if (typeof performance?.getEntriesByName !== 'function') {
    return undefined;
  }

  const entries = performance.getEntriesByName(url, 'resource');
  const lastEntry = entries[entries.length - 1];
  const responseStatus = lastEntry && 'responseStatus' in lastEntry ? lastEntry.responseStatus : undefined;

  if (typeof responseStatus !== 'number' || responseStatus < 400) {
    return undefined;
  }

  return responseStatus;
}

export function extractPluginIdFromUrl(url: string): string | undefined {
  const pluginPathMatch = url.match(PLUGIN_PATH_REGEX);
  if (pluginPathMatch) {
    return pluginPathMatch[1];
  }

  const decoupledPluginMatch = url.match(DECOUPLED_PLUGIN_REGEX);
  if (decoupledPluginMatch) {
    return decoupledPluginMatch[1];
  }

  return undefined;
}

export function isChunkLoadError(error: unknown): error is Error & { type?: string; request?: string } {
  return error instanceof Error && error.name === 'ChunkLoadError';
}

export function getChunkLoadErrorUrl(message: string): string | undefined {
  return message.match(CHUNK_LOAD_ERROR_URL_REGEX)?.[1];
}

export function classifyPluginLoadError(error: unknown): PluginLoadErrorInfo {
  if (!(error instanceof Error)) {
    return { errorType: 'unknown', httpStatusSource: 'none' };
  }

  if (error instanceof PluginAssetFetchError) {
    if (error.status) {
      return { errorType: 'http', httpStatus: error.status, httpStatusSource: 'response', failedUrl: error.url };
    }
    return { errorType: 'network', httpStatusSource: 'none', failedUrl: error.url };
  }

  if (isChunkLoadError(error)) {
    return classifyChunkLoadError(error);
  }

  const scriptLoadMatch = error.message.match(SCRIPT_LOAD_ERROR_REGEX);
  if (scriptLoadMatch) {
    const failedUrl = scriptLoadMatch[1];
    const httpStatus = getResourceStatus(failedUrl);
    if (httpStatus) {
      return { errorType: 'http', httpStatus, httpStatusSource: 'resource-timing', failedUrl };
    }
    return { errorType: 'load-failed', httpStatusSource: 'none', failedUrl };
  }

  const fetchStatusMatch = error.message.match(FETCH_STATUS_ERROR_REGEX);
  if (fetchStatusMatch) {
    return {
      errorType: 'http',
      httpStatus: Number(fetchStatusMatch[1]),
      httpStatusSource: 'message',
      failedUrl: fetchStatusMatch[2],
    };
  }

  const contentTypeMatch = error.message.match(CONTENT_TYPE_ERROR_REGEX);
  if (contentTypeMatch) {
    return { errorType: 'invalid-module', httpStatusSource: 'none', failedUrl: contentTypeMatch[1] };
  }

  return { errorType: 'evaluation', httpStatusSource: 'none' };
}

function classifyChunkLoadError(error: Error & { type?: string; request?: string }): PluginLoadErrorInfo {
  const failedUrl = error.request ?? getChunkLoadErrorUrl(error.message);
  const httpStatus = failedUrl ? getResourceStatus(failedUrl) : undefined;

  return {
    errorType: 'chunk-load',
    httpStatusSource: httpStatus ? 'resource-timing' : 'none',
    ...(httpStatus && { httpStatus }),
    ...(failedUrl && { failedUrl }),
    ...(error.type && { chunkErrorType: error.type }),
  };
}
