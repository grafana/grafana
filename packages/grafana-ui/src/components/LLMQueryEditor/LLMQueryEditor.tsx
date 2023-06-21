import { DataQuery, DataSourceApi } from '@grafana/data';
import { DataSourceJsonData } from '@grafana/schema';
import React, { useState } from 'react';

import { useAsyncFn } from 'react-use';

import { Button } from '../Button';
import { Field } from '../Forms/Field';
import { Form } from '../Forms/Form';
import { Input } from '../Input/Input';
import { Spinner } from '../Spinner/Spinner';

interface LLMSrvChatMessage {
  role: string;
  content: string;
}

interface LLMSrvChatCompletionRequest {
  model?: string;
  messages: LLMSrvChatMessage[];
}

interface LLMRelatedMetadataRequest {
  datasourceType: string;
  datasourceUid: string;
  text: string;
}

type DataSourceMetadata<T extends string> = {
  [key in T]?: string[];
}

// We can't import the real interface from @grafana/runtime, but
// we can use this subset. Hooray for structural typing!
interface LLMSrv {
  chatCompletions(request: LLMSrvChatCompletionRequest): Promise<string>;
  relatedMetadata<M extends string>(request: LLMRelatedMetadataRequest): Promise<DataSourceMetadata<M>>;
}

export interface LLMQueryEditorProps<
  T extends DataSourceApi<Q, O, QIC, M>,
  M extends string,
  Q extends DataQuery = DataQuery,
  O extends DataSourceJsonData = DataSourceJsonData,
  QIC extends Record<string, object> = {},
> {
  systemPrompt: string;
  createPrompt?: (metadata: DataSourceMetadata<M>) => string;
  onChange: (text: string) => void;
  datasource: DataSourceApi<Q, O, QIC, M>;
  llmSrv: LLMSrv; // Can't import @grafana/runtime here
}

export function LLMQueryEditor<
  T extends DataSourceApi<Q, O, QIC, M>,
  M extends string,
  Q extends DataQuery = DataQuery,
  O extends DataSourceJsonData = DataSourceJsonData,
  QIC extends Record<string, object> = {},
>({
  systemPrompt,
  createPrompt,
  onChange,
  llmSrv,
  datasource: { uid: datasourceUid, type: datasourceType },
}: LLMQueryEditorProps<T, M, Q, O, QIC>): JSX.Element {
  const [query, setQuery] = useState('');
  const [usedSystemPrompt, setUsedSystemPrompt] = useState('');
  const [state, onSubmit] = useAsyncFn(
    async ({ userPrompt }: { userPrompt: string }) => {
      if (createPrompt !== undefined) {
        const metadata = await llmSrv.relatedMetadata<M>({
          type: 'datasource',
          datasourceUid,
          datasourceType,
          text: userPrompt,
        });
        console.log(metadata);
        systemPrompt = createPrompt(metadata);
      }
      console.log(systemPrompt);
      setUsedSystemPrompt(systemPrompt);
      const returnedMessage = await llmSrv.chatCompletions({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      setQuery(returnedMessage);
      onChange(returnedMessage);
    },
    [systemPrompt, onChange]
  );

  return (
    <div>
      <Form onSubmit={onSubmit}>
        {({ register }) => {
          return (
            <>
              <Field>
                <Input {...register('userPrompt')} />
              </Field>
              <Button type="submit">Translate</Button>
            </>
          );
        }}
      </Form>
      <br />
      {state.loading ? (
        <Spinner />
      ) : state.error ? (
        <div>Something went wrong! Error: {state.error.message}</div>
      ) : (
        <>
          {query !== '' && <div>
            <h3>Returned query</h3>
            <pre>{query}</pre>
          </div>
          }
          {usedSystemPrompt !== '' && <div>
            <h3>System prompt</h3>
            <pre>{usedSystemPrompt}</pre>
          </div>
          }
        </>
      )}
    </div>
  );
}
