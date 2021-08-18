import React, { useState, useEffect } from 'react';
import {
  InlineFieldRow,
  InlineField,
  Input,
  QueryField,
  Select,
  SlatePrism,
  BracesPlugin,
  TypeaheadInput,
  TypeaheadOutput,
} from '@grafana/ui';
import { tokenizer } from './syntax';
import Prism from 'prismjs';
import { Node } from 'slate';
import { css } from '@emotion/css';
import { SelectableValue } from '@grafana/data';
import TempoLanguageProvider from './language_provider';
import { TempoQuery } from './datasource';

interface Props {
  languageProvider: TempoLanguageProvider;
  query: TempoQuery;
  onChange: (value: TempoQuery) => void;
  onBlur?: () => void;
  onRunQuery: () => void;
}

const PRISM_LANGUAGE = 'tempo';
const durationPlaceholder = 'e.g. 1.2s, 100ms, 500us';
const plugins = [
  BracesPlugin(),
  SlatePrism({
    onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
    getSyntax: () => PRISM_LANGUAGE,
  }),
];

Prism.languages[PRISM_LANGUAGE] = tokenizer;

const NativeSearch = ({ languageProvider, query, onChange, onBlur, onRunQuery }: Props) => {
  const [hasSyntaxLoaded, setHasSyntaxLoaded] = useState(false);
  const [autocomplete, setAutocomplete] = useState<{
    serviceNameOptions: Array<SelectableValue<string>>;
    spanNameOptions: Array<SelectableValue<string>>;
  }>({
    serviceNameOptions: [],
    spanNameOptions: [],
  });

  useEffect(() => {
    const fetchAutocomplete = async () => {
      await languageProvider.start();
      const serviceNameOptions = await languageProvider.getOptions('service.name');
      const spanNameOptions = await languageProvider.getOptions('name');
      setHasSyntaxLoaded(true);
      setAutocomplete({ serviceNameOptions, spanNameOptions });
    };
    fetchAutocomplete();
  }, [languageProvider]);

  const onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    return await languageProvider.provideCompletionItems(typeahead);
  };

  const cleanText = (text: string) => {
    const splittedText = text.split(/\s+(?=([^"]*"[^"]*")*[^"]*$)/g);
    if (splittedText.length > 1) {
      return splittedText[splittedText.length - 1];
    }
    return text;
  };

  return (
    <div className={css({ maxWidth: '500px' })}>
      <InlineFieldRow>
        <InlineField label="Service Name" labelWidth={14} grow>
          <Select
            menuShouldPortal
            options={autocomplete.serviceNameOptions}
            value={query.serviceName || ''}
            onChange={(v) => {
              onChange({
                ...query,
                serviceName: v?.value || undefined,
              });
            }}
            placeholder="Select a service"
            isClearable
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Span Name" labelWidth={14} grow>
          <Select
            menuShouldPortal
            options={autocomplete.spanNameOptions}
            value={query.spanName || ''}
            onChange={(v) => {
              onChange({
                ...query,
                spanName: v?.value || undefined,
              });
            }}
            placeholder="Select a span"
            isClearable
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Tags" labelWidth={14} grow tooltip="Values should be in the logfmt format.">
          <QueryField
            additionalPlugins={plugins}
            query={query.search}
            onTypeahead={onTypeahead}
            onBlur={onBlur}
            onChange={(value) => {
              onChange({
                ...query,
                search: value,
              });
            }}
            cleanText={cleanText}
            onRunQuery={onRunQuery}
            syntaxLoaded={hasSyntaxLoaded}
            portalOrigin="tempo"
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Min Duration" labelWidth={14} grow>
          <Input
            value={query.minDuration || ''}
            placeholder={durationPlaceholder}
            onChange={(v) =>
              onChange({
                ...query,
                minDuration: v.currentTarget.value,
              })
            }
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Max Duration" labelWidth={14} grow>
          <Input
            value={query.maxDuration || ''}
            placeholder={durationPlaceholder}
            onChange={(v) =>
              onChange({
                ...query,
                maxDuration: v.currentTarget.value,
              })
            }
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Limit" labelWidth={14} grow tooltip="Maximum numbers of returned results">
          <Input
            value={query.limit || ''}
            type="number"
            onChange={(v) =>
              onChange({
                ...query,
                limit: v.currentTarget.value ? parseInt(v.currentTarget.value, 10) : undefined,
              })
            }
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
};

export default NativeSearch;
