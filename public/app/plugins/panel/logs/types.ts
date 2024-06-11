import { DataFrame } from '@grafana/data';

export { Options } from './panelcfg.gen';

type onClickFilterLabelType = (key: string, value: string, frame?: DataFrame) => void;
type onClickFilterOutLabelType = (key: string, value: string, frame?: DataFrame) => void;
type onClickFilterValueType = (value: string, refId?: string) => void;
type onClickFilterOutStringType = (value: string, refId?: string) => void;
type isFilterLabelActiveType = (key: string, value: string, refId?: string) => Promise<boolean>;

export function isOnClickFilterLabel(callback: unknown): callback is onClickFilterLabelType {
  return typeof callback === 'function';
}

export function isOnClickFilterOutLabel(callback: unknown): callback is onClickFilterOutLabelType {
  return typeof callback === 'function';
}

export function isOnClickFilterString(callback: unknown): callback is onClickFilterValueType {
  return typeof callback === 'function';
}

export function isOnClickFilterOutString(callback: unknown): callback is onClickFilterOutStringType {
  return typeof callback === 'function';
}

export function isIsFilterLabelActive(callback: unknown): callback is isFilterLabelActiveType {
  return typeof callback === 'function';
}
