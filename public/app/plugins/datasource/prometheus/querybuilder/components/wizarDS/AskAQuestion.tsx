import React, { useState } from 'react';

import { Button, Input, Stack } from '@grafana/ui';

type AskAQuestionprops = {
  'data-testid': string;
  isDisabled: boolean;
  isLoading: boolean;
  onSubmit: (prompt: string) => void;
};

export const AskAQuestion = ({ 'data-testid': dataTestId, isDisabled, isLoading, onSubmit }: AskAQuestionprops) => {
  const [value, setValue] = useState<string>('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        if (value) {
          onSubmit(value);
        }
      }}
    >
      <Stack direction={'column'}>
        <label htmlFor={dataTestId}>How can I help you?</label>
        <Stack>
          <Input
            id={dataTestId}
            value={value}
            spellCheck={false}
            placeholder="Enter prompt"
            disabled={isDisabled}
            onChange={(e) => {
              setValue(e.currentTarget.value);
            }}
          />

          <Button
            icon={isLoading ? `fa fa-spinner` : undefined}
            disabled={isDisabled}
            fill="solid"
            variant="primary"
            data-testid={dataTestId}
            type="submit"
          >
            Go
          </Button>
        </Stack>
      </Stack>
    </form>
  );
};
