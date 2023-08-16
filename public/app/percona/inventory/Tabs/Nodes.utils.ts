import { stripServiceId } from './Services.utils';

export const stripNodeId = (nodeId: string) => {
  const regex = /\/node_id\/(.*)/gm;
  const match = regex.exec(nodeId);

  if (match && match.length > 0) {
    return match[1] || '';
  }

  return '';
};

export const formatNodeId = (nodeId: string) => `/node_id/${nodeId}`;

export const getServiceLink = (serviceId: string) => {
  const strippedId = stripServiceId(serviceId);
  return `/inventory/services?search-text-input=${strippedId}&search-select=serviceId`;
};
