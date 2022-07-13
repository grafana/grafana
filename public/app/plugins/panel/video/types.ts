import { DataHoverPayload } from '@grafana/data';

export interface VideoTimeEncoding {
  offset: number;
  time: number;
}

export interface VideoPlayPayload extends DataHoverPayload {
  point: {
    time: number; // absolute time
    offset: number; // millis since start
    duration: number; // time in seconds of clip
  };
}
