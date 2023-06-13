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

// We can't import the real interface from @grafana/runtime, but
// we can use this subset. Hooray for structural typing!
interface LLMSrv {
  chatCompletions(request: LLMSrvChatCompletionRequest): Promise<string>;
}

export interface LLMQueryEditorProps {
  systemPrompt: string;
  onChange: (text: string) => void;
  llmSrv: LLMSrv; // Can't import @grafana/runtime here
}

export function LLMQueryEditor({ systemPrompt, onChange, llmSrv }: LLMQueryEditorProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [state, onSubmit] = useAsyncFn(
    async ({ prompt }: { prompt: string }) => {
      const returnedMessage = await llmSrv.chatCompletions({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
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
                <Input {...register('prompt')} />
              </Field>
              <Button type="submit">Translate</Button>
            </>
          );
        }}
      </Form>
      {state.loading ? (
        <Spinner />
      ) : state.error ? (
        <div>Something went wrong! Error: {state.error.message}</div>
      ) : (
        query !== '' && <div>{query}</div>
      )}
    </div>
  );
}
