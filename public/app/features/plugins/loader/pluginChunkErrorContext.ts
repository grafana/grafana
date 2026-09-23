import { type ExceptionEvent, type TransportItem, TransportItemType } from '@grafana/faro-core';

import { extractPluginIdFromUrl, getResourceStatus, parseChunkLoadErrorMessage } from './pluginLoadError';

function isExceptionItem(item: TransportItem): item is TransportItem<ExceptionEvent> {
  return item.type === TransportItemType.EXCEPTION;
}

// Chunk load errors reach Faro from several places (error boundaries, console capture, unhandled
// rejections), and most of them don't know which plugin the chunk belongs to, so add it here.
export function addPluginChunkErrorContext(item: TransportItem): TransportItem {
  if (!isExceptionItem(item) || item.payload.type !== 'ChunkLoadError') {
    return item;
  }

  const chunkError = parseChunkLoadErrorMessage(item.payload.value);
  if (!chunkError) {
    return item;
  }

  const pluginId = extractPluginIdFromUrl(chunkError.url);
  if (!pluginId) {
    return item;
  }

  const httpStatus = getResourceStatus(chunkError.url);
  item.payload.context = {
    ...item.payload.context,
    pluginId,
    errorType: 'chunk-load',
    chunkErrorType: chunkError.chunkErrorType,
    failedUrl: chunkError.url,
    httpStatusSource: httpStatus ? 'resource-timing' : 'none',
    ...(httpStatus && { httpStatus: String(httpStatus) }),
  };

  return item;
}
