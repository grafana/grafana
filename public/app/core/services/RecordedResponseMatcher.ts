import { BackendSrvRequest, FetchResponse } from '@grafana/runtime/src';
import { dateMath, dateTime, isDateTime } from '@grafana/data/src';

import { RequestResponseRecording } from './RequestResponseRecorder';

export interface MatchesRecordedResponses {
  clear: () => void;
  load: (recordings: RequestResponseRecording[]) => void;
  find: <T>(options: BackendSrvRequest) => FetchResponse<T> | undefined;
}

interface FlattenedOptionsResponse {
  flattenedRecordedOptions: Record<string, any>;
  fetchResponse: FetchResponse;
}

const SLUG_REGEX = /^[a-zA-Z0-9\\-\\_]*$/g;
const EPOC_REGEX = /[0-9]{9,10}/g;
const DIGIT_REGEX = /[0-9]/g;

class RecordedResponseMatcher implements MatchesRecordedResponses {
  private recordings: FlattenedOptionsResponse[] = [];

  constructor() {}

  clear() {
    this.recordings = [];
  }

  load(recordings: RequestResponseRecording[]) {
    for (const recording of recordings) {
      const { options, fetchResponse } = recording;
      const flattenedRecordedOptions = this.flattenOptionsObject(options);
      this.recordings.push({ flattenedRecordedOptions, fetchResponse });
    }
  }

  find<T>(options: BackendSrvRequest): FetchResponse<T> | undefined {
    if (this.recordings.length === 0) {
      return undefined;
    }

    const flattenedOptions = this.flattenOptionsObject(options);
    const keys = Object.keys(flattenedOptions);

    const matches: Record<number, number> = {};
    for (let index = 0; index < this.recordings.length; index++) {
      const { flattenedRecordedOptions } = this.recordings[index];
      for (const key of keys) {
        if (flattenedRecordedOptions.hasOwnProperty(key)) {
          const value = flattenedOptions[key];
          const recorded = flattenedRecordedOptions[key];
          if (value === recorded) {
            matches[index] = matches[index] ?? 0;
            matches[index]++;
          }
        }
      }
    }

    let bestMatch = Object.keys(matches).find((key) => {
      return matches[Number(key)] === keys.length;
    });

    if (!bestMatch) {
      return undefined;
    }

    return (this.recordings[Number(bestMatch)].fetchResponse as unknown) as FetchResponse<T>;
  }

  private flattenOptions(key: string, value: any, level = 0, flattened: Record<string, any> = {}): Record<string, any> {
    const keyLevel = `${key}_${level}`;
    if (value === null) {
      flattened[keyLevel] = value;
    } else if (value === undefined) {
      return flattened;
    } else if (isDateTime(value)) {
      flattened[keyLevel] = 'datetime';
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        this.flattenOptions(`${keyLevel}[${i}]`, value[i], level + 1, flattened);
      }
    } else if (typeof value === 'object') {
      const keys = Object.keys(value);
      for (const key of keys) {
        this.flattenOptions(key, value[key], level + 1, flattened);
      }
    } else if (typeof value === 'function') {
      return flattened;
    } else if (typeof value === 'symbol') {
      return flattened;
    } else if (typeof value === 'string' && dateTime(value).isValid()) {
      flattened[keyLevel] = 'datetime';
    } else if (typeof value === 'string' && dateMath.isMathString(value)) {
      flattened[keyLevel] = 'datetime';
    } else if (typeof value === 'string') {
      if (value.match(SLUG_REGEX)) {
        value = value?.replace(SLUG_REGEX, 'slug');
      }
      if (value.match(EPOC_REGEX)) {
        value = value?.replace(EPOC_REGEX, 'epoc');
      }
      if (value.match(DIGIT_REGEX)) {
        value = value?.replace(DIGIT_REGEX, '');
      }

      flattened[keyLevel] = value;
    } else if (typeof value === 'number') {
      flattened[keyLevel] = 1;
    } else {
      flattened[keyLevel] = value;
    }

    return flattened;
  }

  private flattenOptionsObject(options: any): Record<string, any> {
    const keys = Object.keys(options);
    const optionAsRecord = options as Record<string, any>;
    const flattened: Record<string, any> = {};
    return keys.reduce((acc, key) => {
      return this.flattenOptions(key, optionAsRecord[key], 0, acc);
    }, flattened);
  }
}

let recordedResponsePlayer: MatchesRecordedResponses | undefined;

export function setRecordedResponsePlayer(recorder: MatchesRecordedResponses) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('RecordedResponseMatcher can be only overriden in test environment');
  }

  recordedResponsePlayer = recorder;
}

export function getRecordedResponsePlayer(): MatchesRecordedResponses {
  if (!recordedResponsePlayer) {
    recordedResponsePlayer = new RecordedResponseMatcher();
  }

  return recordedResponsePlayer;
}
