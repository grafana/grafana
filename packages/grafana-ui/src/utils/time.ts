import { toUtc, rangeUtil } from '@grafana/data';

interface AbsoluteTimeRangeURLOptions {
  url?: string;
  fromParam?: string;
  toParam?: string;
}

const DEFAULT_FROM_PARAM = 'from';
const DEFAULT_TO_PARAM = 'to';
const MINUTE_IN_MILLISECONDS = 60 * 1000;
const DEFAULT_TIME_RANGE_MINUTES = 30;

export function absoluteTimeRangeURL(opts?: AbsoluteTimeRangeURLOptions): string {
  try {
    const { url, fromParam = DEFAULT_FROM_PARAM, toParam = DEFAULT_TO_PARAM } = opts ?? {};

    // handle URL parsing
    let baseUrl: string;
    let queryParams: URLSearchParams;

    try {
      if (url) {
        const parsedUrl = new URL(url);
        baseUrl = parsedUrl.href.split('?')[0];
        queryParams = new URLSearchParams(parsedUrl.search);
      } else {
        baseUrl = window.location.href.split('?')[0];
        queryParams = new URLSearchParams(window.location.search);
      }
    } catch (error) {
      console.error('Failed to parse URL:', error);
      return url ?? window.location.href;
    }

    const from = queryParams.get(fromParam);
    const to = queryParams.get(toParam);

    if (!from || !to) {
      const now = Date.now();
      queryParams.set(toParam, toUtc(now).valueOf().toString());
      queryParams.set(
        fromParam,
        toUtc(now - DEFAULT_TIME_RANGE_MINUTES * MINUTE_IN_MILLISECONDS)
          .valueOf()
          .toString()
      );

      return `${baseUrl}?${queryParams.toString()}`;
    }

    if (rangeUtil.isRelativeTime(to) || rangeUtil.isRelativeTime(from)) {
      try {
        const range = rangeUtil.convertRawToRange({ from, to });

        if (!range.from || !range.to || isNaN(range.from.valueOf()) || isNaN(range.to.valueOf())) {
          throw new Error('Invalid time range conversion');
        }

        queryParams.set(fromParam, toUtc(range.from).valueOf().toString());
        queryParams.set(toParam, toUtc(range.to).valueOf().toString());

        return `${baseUrl}?${queryParams.toString()}`;
      } catch (error) {
        console.error('Failed to convert relative time range:', error);
        return `${baseUrl}?${queryParams.toString()}`;
      }
    }

    return `${baseUrl}?${queryParams.toString()}`;
  } catch (error) {
    console.error('Error in absoluteTimeRangeURL:', error);
    return opts?.url ?? window.location.href;
  }
}
