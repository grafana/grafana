import React from 'react';

import { Button, Input, Stack } from '@grafana/ui';

type AskAQuestionprops = {
  'data-testid': string;
  isDisabled: boolean;
  isLoading: boolean;
  onChange: (promot: string) => void;
  onSubmit: (prompt: string) => void;
  value: string;
};

export const AskAQuestion = ({
  'data-testid': dataTestId,
  isDisabled,
  isLoading,
  onChange,
  onSubmit,
  value,
}: AskAQuestionprops) => {
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
            onChange={(e) => onChange(e.currentTarget.value)}
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
