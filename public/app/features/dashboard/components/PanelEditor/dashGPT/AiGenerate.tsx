import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Button, IconButton, Toggletip, useStyles2 } from '@grafana/ui';

interface Props {
  text: string;
  onClick: () => void;
  history?: string[];
  applySuggestion?: (suggestion: string) => void;
}

export const AiGenerate = ({ text, onClick, history, applySuggestion }: Props) => {
  const styles = useStyles2(getStyles);

  const [shouldClose, setShouldClose] = React.useState(false);

  const suggestionApply = (suggestion: string) => {
    if (applySuggestion) {
      applySuggestion(suggestion);
      setShouldClose(true);
    }

    setTimeout(() => {
      setShouldClose(false);
    });
  };

  const retrySuggestion = () => {
    console.log('retrySuggestion');
  };

  const renderHistory = () => {
    return (
      <div className={styles.history}>
        {history?.map((item, index) => {
          return (
            <div key={index} className={styles.historyItems}>
              <div className={styles.item}>{item}</div>
              <div className={styles.buttons}>
                <IconButton name="clipboard-alt" aria-label="clipboard-alt" onClick={() => suggestionApply(item)} />
                <IconButton name="sync" aria-label="sync" onClick={retrySuggestion} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.wrapper}>
      <Button icon="grafana" onClick={onClick} fill="text" size="sm">
        {text}
      </Button>
      {history && history.length > 0 && history[0] !== '' && (
        <Toggletip content={renderHistory} closeButton={false} placement="bottom-start" shouldClose={shouldClose}>
          <IconButton name="history" aria-label="history" />
        </Toggletip>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
  `,
  history: css``,
  historyItems: css`
    display: flex;
    align-items: flex-start;
    padding: 5px 0;
  `,
  buttons: css`
    align-items: flex-end;
  `,
  item: css`
    margin-right: 10px;
    font-size: ${theme.typography.size.md};
  `,
});
