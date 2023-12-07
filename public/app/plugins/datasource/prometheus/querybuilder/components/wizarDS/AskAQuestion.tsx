import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Input, Stack, useStyles2 } from '@grafana/ui';

type AskAQuestionprops = {
  'data-testid': string;
  hasSuggestions: boolean;
  isLoading: boolean;
  onCancel: () => void;
  onSubmit: (prompt: string) => void;
};

export const AskAQuestion = ({
  'data-testid': dataTestId,
  hasSuggestions,
  isLoading,
  onCancel,
  onSubmit,
}: AskAQuestionprops) => {
  const styles = useStyles2(getStyles);
  const [value, setValue] = useState<string>('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <p>How can I help you?</p>
      <div className={cx(styles.secondaryText, styles.bottomMargin)}>
        <div>Example: How do I select a metric and add operations?</div>
      </div>
      <div className={styles.inputPadding}>
        <Input
          value={value}
          spellCheck={false}
          placeholder="Enter prompt"
          disabled={hasSuggestions}
          onChange={(e) => {
            setValue(e.currentTarget.value);
          }}
        />
      </div>
      {hasSuggestions ? null : (
        <Stack>
          <div className={styles.rightButtons}>
            <Button disabled={isLoading} fill="outline" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>

            <Button
              name={`fa spinner`}
              disabled={isLoading}
              fill="solid"
              variant="primary"
              data-testid={dataTestId}
              type="submit"
            >
              Submit
            </Button>
          </div>
        </Stack>
      )}
    </form>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  secondaryText: css({
    color: theme.colors.text.secondary,
  }),
  bottomMargin: css({
    marginBottom: theme.spacing(2),
  }),
  infoContainerWrapper: css({
    maxHeight: '400px',
    overflow: 'auto',
    marginBottom: theme.spacing(2),
  }),
  infoContainer: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: theme.spacing(2),
  }),
  inputPadding: css({
    marginBottom: theme.spacing(2),
  }),
  rightButtons: css({
    display: 'flex',
    flexWrap: `nowrap`,
    marginLeft: 'auto',
    gap: theme.spacing(1),
  }),
});
