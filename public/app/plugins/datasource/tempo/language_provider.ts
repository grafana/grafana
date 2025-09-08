import { AdHocVariableFilter, LanguageProvider, SelectableValue, TimeRange } from '@grafana/data';
import { BackendSrvRequest, getTemplateSrv } from '@grafana/runtime';
import { VariableFormatID } from '@grafana/schema';

import {
  filterToQuerySection,
  getAllTags,
  getIntrinsicTags,
  getTagsByScope,
  getUnscopedTags,
} from './SearchTraceQLEditor/utils';
import { DEFAULT_TIME_RANGE_FOR_TAGS } from './configuration/TagsTimeRangeSettings';
import { TraceqlFilter, TraceqlSearchScope } from './dataquery.gen';
import { TempoDatasource } from './datasource';
import { enumIntrinsics, intrinsicsV1 } from './traceql/traceql';
import { Scope } from './types';

// Limit maximum tags retrieved from the backend
export const TAGS_LIMIT = 5000;

// Limit maximum options in select dropdowns
export const OPTIONS_LIMIT = 1000;

interface GetOptionsV2 {
  tag: string;
  query?: string;
  timeRangeForTags?: number;
  range?: TimeRange;
}

export default class TempoLanguageProvider extends LanguageProvider {
  datasource: TempoDatasource;
  tagsV2?: Scope[];
  private previousRange?: TimeRange;

  constructor(datasource: TempoDatasource, initialValues?: any) {
    super();

    this.datasource = datasource;
    Object.assign(this, initialValues);
  }

  request = async (url: string, params = {}) => {
    return await this.datasource.metadataRequest(url, params);
  };

  start = async (range?: TimeRange, timeRangeForTags?: number) => {
    // Check if we need to refetch tags due to range changes (minute-level granularity)
    const shouldRefetch = this.shouldRefreshLabels(range, this.previousRange);

    if (!this.startTask || shouldRefetch) {
      // Store the current range for future comparison
      this.previousRange = range;

      this.startTask = this.fetchTags(timeRangeForTags, range).then(() => {
        return [];
      });
    }

    return this.startTask;
  };

  roundMsToMin = (milliseconds: number) => {
    return this.roundSecToMin(milliseconds / 1000);
  };

  roundSecToMin = (seconds: number) => {
    return Math.floor(seconds / 60);
  };

  shouldRefreshLabels = (range?: TimeRange, prevRange?: TimeRange): boolean => {
    if (range && prevRange) {
      const sameMinuteFrom = this.roundMsToMin(range.from.valueOf()) === this.roundMsToMin(prevRange.from.valueOf());
      const sameMinuteTo = this.roundMsToMin(range.to.valueOf()) === this.roundMsToMin(prevRange.to.valueOf());
      // If both are same, don't need to refresh
      return !(sameMinuteFrom && sameMinuteTo);
    }
    // If one is defined and the other is not, we should refresh
    return prevRange !== range;
  };

  getTagsLimit = () => {
    return this.datasource.instanceSettings.jsonData?.tagLimit || TAGS_LIMIT;
  };

  async fetchTags(timeRangeForTags?: number, range?: TimeRange) {
    const params: { limit: number; start?: number; end?: number } = {
      limit: this.getTagsLimit(),
    };
    if (timeRangeForTags && range && timeRangeForTags !== DEFAULT_TIME_RANGE_FOR_TAGS) {
      const { start, end } = this.getTimeRangeForTags(timeRangeForTags, range);
      params.start = start;
      params.end = end;
    }
    const v2Resp = await this.request(`tags`, params);

    if (v2Resp && v2Resp.scopes) {
      this.setV2Tags(v2Resp.scopes);
    }
  }

  setV2Tags = (tags: Scope[]) => {
    this.tagsV2 = tags;
  };

  getIntrinsics = () => {
    if (this.tagsV2) {
      return getIntrinsicTags(this.tagsV2);
    }
    return intrinsicsV1;
  };

  getTags = (scope?: TraceqlSearchScope) => {
    if (this.tagsV2 && scope) {
      if (scope === TraceqlSearchScope.Unscoped) {
        return getUnscopedTags(this.tagsV2);
      }
      return getTagsByScope(this.tagsV2, scope);
    }
    return [];
  };

  getTraceqlAutocompleteTags = (scope?: string) => {
    if (this.tagsV2) {
      if (!scope) {
        // have not typed a scope yet || unscoped (.) typed
        return getUnscopedTags(this.tagsV2);
      } else if (scope === TraceqlSearchScope.Unscoped) {
        return getUnscopedTags(this.tagsV2);
      }
      return getTagsByScope(this.tagsV2, scope);
    }
    return [];
  };

  getAutocompleteTags = () => {
    if (this.tagsV2) {
      return getAllTags(this.tagsV2);
    }
    return [];
  };

  async getOptionsV2({ tag, query, timeRangeForTags, range }: GetOptionsV2): Promise<Array<SelectableValue<string>>> {
    const encodedTag = this.encodeTag(tag);
    const params: { q?: string; limit: number; start?: number; end?: number; tag?: string } = {
      limit: this.getTagsLimit(),
    };

    if (query) {
      params.q = getTemplateSrv().replace(query, {}, VariableFormatID.Pipe);
    }

    if (timeRangeForTags && range && timeRangeForTags !== DEFAULT_TIME_RANGE_FOR_TAGS) {
      const { start, end } = this.getTimeRangeForTags(timeRangeForTags, range);
      params.start = start;
      params.end = end;
    }

    // Add the encoded tag as a query parameter for the new resource endpoint
    params.tag = encodedTag;
    const response = await this.request(`tag-values`, params);

    let options: Array<SelectableValue<string>> = [];
    if (response && response.tagValues) {
      response.tagValues.forEach((v: { type: string; value?: string }) => {
        if (v.value) {
          options.push({
            type: v.type,
            value: v.value,
            label: v.value,
          });
        }
      });
    }
    return options;
  }

  getTimeRangeForTags = (timeRangeForTags: number, range: TimeRange) => {
    // Get tags from the last timeRangeForTags seconds, but don't go before the start of the range
    // If timeRangeForTags is 1 hour and your query range is 24 hours, it will fetch tags from the last 1 hour of that 24-hour period
    // If timeRangeForTags is larger than the total range duration, it will use the entire available range
    const start = Math.max(range.from.unix(), range.to.unix() - timeRangeForTags);
    const end = range.to.unix();
    return { start, end };
  };

  /**
   * Encode (serialize) a given tag for use in a URL.
   *
   * @param tag the tag to encode
   * @returns the encoded tag
   */
  private encodeTag = (tag: string): string => {
    // If we call `encodeURIComponent` only once, we still get an error when issuing a request to the backend
    // Reference: https://stackoverflow.com/a/37456192
    return encodeURIComponent(encodeURIComponent(tag));
  };

  generateQueryFromFilters({
    traceqlFilters,
    adhocFilters,
  }: {
    traceqlFilters?: TraceqlFilter[];
    adhocFilters?: AdHocVariableFilter[];
  }) {
    if (!traceqlFilters && !adhocFilters) {
      return '';
    }

    const allFilters = [
      ...this.generateQueryFromTraceQlFilters(traceqlFilters || []),
      ...this.generateQueryFromAdHocFilters(adhocFilters || []),
    ];

    return `{${allFilters.join(' && ')}}`;
  }

  private generateQueryFromTraceQlFilters(filters: TraceqlFilter[]) {
    if (!filters) {
      return '';
    }

    return filters
      .filter((f) => f.tag && f.operator && f.value?.length)
      .map((f) => filterToQuerySection(f, filters, this));
  }

  private generateQueryFromAdHocFilters = (filters: AdHocVariableFilter[]) => {
    return filters
      .filter((f) => f.key && f.operator && f.value)
      .map((f) => `${f.key}${f.operator}${this.adHocValueHelper(f)}`);
  };

  adHocValueHelper = (f: AdHocVariableFilter) => {
    if (this.getIntrinsics().find((t) => t === f.key) && enumIntrinsics.includes(f.key)) {
      return f.value;
    }
    if (parseInt(f.value, 10).toString() === f.value) {
      return f.value;
    }
    return `"${f.value}"`;
  };
}
