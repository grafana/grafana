import React from 'react';
import { QueryBuilderProps } from '../types';
import { QueryBuilderComponentSelector } from '../abstract';
import {
  Bucket,
  Cascade,
  Identity,
  Javascript,
  Lookup,
  Lower,
  Partial,
  Regex,
  RegisteredLookup,
  SearchQuery,
  StringFormat,
  StrLen,
  Substring,
  TimeFormat,
  Time,
  Upper,
} from './';

export const ExtractionFn = (props: QueryBuilderProps) => (
  <QueryBuilderComponentSelector
    {...props}
    label="ExtractionFn"
    components={{
      Bucket: Bucket,
      Cascade: Cascade,
      Identity: Identity,
      Javascript: Javascript,
      Lookup: Lookup,
      Lower: Lower,
      Partial: Partial,
      Regex: Regex,
      RegisteredLookup: RegisteredLookup,
      SearchQuery: SearchQuery,
      StringFormat: StringFormat,
      StrLen: StrLen,
      Substring: Substring,
      TimeFormat: TimeFormat,
      Time: Time,
      Upper: Upper,
    }}
  />
);
