import { CollectorItem, CollectorWorkers, Sanitizer } from '../types';

export class UrlSanitizer implements Sanitizer {
  constructor(readonly id: string, private readonly replaceWith = '******') {}

  canSanitize(item: CollectorItem): boolean {
    switch (item.id) {
      case CollectorWorkers.panelJson:
      case CollectorWorkers.dashboard:
        return true;

      default:
        return false;
    }
  }

  sanitize(item: CollectorItem): Record<string, any> {
    switch (item.id) {
      case CollectorWorkers.panelJson:
      case CollectorWorkers.dashboard:
        const target: Record<string, any> = {};
        copyWithoutUrls(this.replaceWith, item.data, target);
        return target;

      default:
        return item.data;
    }
  }
}

const copyWithoutUrls = (replaceWith: string, source: Record<string, any>, target: Record<string, any>) => {
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }

    const value = source[key];

    if (typeof value === 'object') {
      const valueTarget = {};
      copyWithoutUrls(replaceWith, value, valueTarget);
      target[key] = valueTarget;
      continue;
    }

    if (Array.isArray(value)) {
      target[key] = value.map((v) => {
        const valueTarget = {};
        copyWithoutUrls(replaceWith, v, valueTarget);
        return valueTarget;
      });
      continue;
    }

    if (typeof value === 'string' && isUrl(value)) {
      target[key] = replaceWith;
      continue;
    }

    target[key] = value;
  }
};

const protocolAndDomainRE = /^(?:\w+:)?\/\/(\S+)$/;
const localhostDomainRE = /^localhost[\:?\d]*(?:[^\:?\d]\S*)?$/;
const nonLocalhostDomainRE = /^[^\s\.]+\.\S{2,}$/;

const isUrl = (str: string): boolean => {
  if (typeof str !== 'string') {
    return false;
  }

  var match = str.match(protocolAndDomainRE);
  if (!match) {
    return false;
  }

  var everythingAfterProtocol = match[1];
  if (!everythingAfterProtocol) {
    return false;
  }

  if (localhostDomainRE.test(everythingAfterProtocol) || nonLocalhostDomainRE.test(everythingAfterProtocol)) {
    return true;
  }

  return false;
};
