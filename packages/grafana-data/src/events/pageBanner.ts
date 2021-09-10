import { BusEventWithPayload } from './types';

/** @alpha */
export class PageBannerDisplayEvent extends BusEventWithPayload<PageBannerEventPayload> {
  static type = 'page-banner-display';
}

/** @alpha */
export type PageBannerEventPayload = {
  text: string;
  closable?: boolean;
  severity?: PageBannerSeverity;
  trailingAction?: PageBannerAction;
};

/** @alpha */
export type PageBannerAction = {
  text: string;
  href: string;
};

/** @alpha */
export enum PageBannerSeverity {
  info,
  warning,
  error,
}
