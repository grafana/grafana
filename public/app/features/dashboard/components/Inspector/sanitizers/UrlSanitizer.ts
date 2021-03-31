import { lowerCase } from 'lodash';
import { CollectorItem, CollectorWorkers, Sanitizer } from '../types';
import { copyAndSanitize, SanitizeContext } from './utils';

export class UrlSanitizer implements Sanitizer {
  private context: SanitizeContext;

  constructor(readonly id: string, replaceWith = '******') {
    this.context = { replaceWith, shouldReplace };
  }

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
        return copyAndSanitize(item.data, this.context);

      default:
        return item.data;
    }
  }
}

const shouldReplace = (key: string, value: any): boolean => {
  if (typeof value === 'string' && lowerCase(key) === 'url') {
    return true;
  }
  if (typeof value === 'string' && isUrl(value)) {
    return true;
  }
  return false;
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
