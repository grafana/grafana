import { BackendSrvRequest, FetchResponse } from '@grafana/runtime/src';
import { dateTime, isDateTime } from '@grafana/data/src';

import { RequestResponseRecording } from './RequestResponseRecorder';

export interface PlaysRecordedResponses {
  load: (recordings: RequestResponseRecording[]) => void;
  find: <T>(options: BackendSrvRequest) => FetchResponse<T> | undefined;
}

class RecordedResponsePlayer implements PlaysRecordedResponses {
  private recordings: RequestResponseRecording[] = [];
  constructor() {}

  load(recordings: RequestResponseRecording[]) {
    this.recordings = recordings;
  }

  find<T>(options: BackendSrvRequest): FetchResponse<T> | undefined {
    if (this.recordings.length === 0) {
      return undefined;
    }

    const flattenedOptions = this.flattenOptionsObject(options);
    const keys = Object.keys(flattenedOptions);
    const flattenedRecordings = this.recordings.map((recording) => {
      const { options, fetchResponse } = recording;
      const flattenedRecordedOptions = this.flattenOptionsObject(options);
      return { flattenedRecordedOptions, fetchResponse };
    });

    const matches: Record<number, number> = {};
    for (let index = 0; index < flattenedRecordings.length; index++) {
      const { flattenedRecordedOptions } = flattenedRecordings[index];
      for (const key of keys) {
        if (flattenedRecordedOptions.hasOwnProperty(key)) {
          const value = flattenedOptions[key];
          const recorded = flattenedRecordedOptions[key];
          if (value === recorded) {
            matches[index] = matches[index] ?? 0;
            matches[index]++;
          } else {
            if (typeof value === 'string' && typeof recorded === 'string') {
              if (value.match(/^[a-zA-Z0-9\\-\\_]*$/) && recorded.match(/^[a-zA-Z0-9\\-\\_]*$/)) {
                matches[index] = matches[index] ?? 0;
                matches[index]++;
              } else {
                const valueWithoutDigits = value ? value?.replace(/[0-9]/g, 'x') : value;
                const recordedWithoutDigits = recorded ? recorded?.replace(/[0-9]/g, 'x') : recorded;
                if (valueWithoutDigits === recordedWithoutDigits) {
                  matches[index] = matches[index] ?? 0;
                  matches[index]++;
                }
              }
            } else if (typeof value === 'number' && typeof recorded === 'number') {
              matches[index] = matches[index] ?? 0;
              matches[index]++;
            }
          }
        }
      }
    }

    let bestMatch = Object.keys(matches).find((key) => {
      return matches[Number(key)] === keys.length;
    });

    if (!bestMatch) {
      return undefined;
      bestMatch = Object.keys(matches).find((key) => {
        return matches[Number(key)] === keys.length - 1;
      });

      if (!bestMatch) {
        return undefined;
      }
    }

    return (flattenedRecordings[Number(bestMatch)].fetchResponse as unknown) as FetchResponse<T>;
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

let recordedResponsePlayer: PlaysRecordedResponses = new RecordedResponsePlayer();

export const setRecordedResponsePlayer = (recorder: PlaysRecordedResponses) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('RecordedResponsePlayer can be only overriden in test environment');
  }
  recordedResponsePlayer = recorder;
};

export const getRecordedResponsePlayer = () => recordedResponsePlayer;
