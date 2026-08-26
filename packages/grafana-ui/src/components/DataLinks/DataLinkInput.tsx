import { lazy, memo, Suspense } from 'react';

import { type VariableSuggestion } from '@grafana/data';

import { Input } from '../Input/Input';

import { type DataLinkInterpolationMode } from './codemirrorUtils';

export interface DataLinkInputProps {
  value: string;
  onChange: (url: string, callback?: () => void) => void;
  suggestions: VariableSuggestion[];
  placeholder?: string;
  // For accessibility, this should be the id of the label that describes this input.
  // This is needed because the input is rendered as a contenteditable element and can't use the normal label/htmlFor logic.
  ['aria-labelledby']?: string;
  // DOM id applied to the input wrapper. Defaults to the URL field's historical
  // id; pass a distinct id when more than one DataLinkInput renders together
  // (e.g. a title alongside a URL) to keep ids unique.
  id?: string;
  // Selects the completion semantics: 'url' (default) treats `=` as a query-param
  // trigger and encodes template vars as `${var:queryparam}`; 'text' triggers on
  // `$` only and applies plain `${var}`, matching how non-URL fields interpolate.
  interpolationMode?: DataLinkInterpolationMode;
  // Forwarded to the inline input; `false` renders the proportional UI font.
  monospace?: boolean;
}

const DataLinkInputImplementation = lazy(() =>
  import(/* webpackChunkName: "react-codemirror-data-link-input" */ './DataLinkInputImplementation').then((module) => ({
    default: module.DataLinkInputImplementation,
  }))
);

export const DataLinkInput = memo(function DataLinkInput(props: DataLinkInputProps) {
  return (
    <Suspense
      fallback={
        <Input
          id={`${props.id ?? 'data-link-input'}-loading`}
          value={props.value}
          placeholder={props.placeholder ?? 'http://your-grafana.com/d/000000010/annotations'}
          readOnly
          tabIndex={-1}
          aria-label=""
          aria-labelledby=""
          aria-hidden
        />
      }
    >
      <DataLinkInputImplementation {...props} />
    </Suspense>
  );
});
