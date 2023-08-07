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

export const AiAssist = ({ text, onClick, history, applySuggestion }: Props) => {
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
            <div key={index} className={styles.historyItem}>
              {item}
              <IconButton name="clipboard-alt" aria-label="clipboard-alt" onClick={() => suggestionApply(item)} />
              <IconButton name="sync" aria-label="sync" onClick={retrySuggestion} />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Button icon="grafana" onClick={onClick} fill="text" size="sm">
        {text}
      </Button>
      {history && history.length > 0 && history[0] !== '' && (
        <Toggletip content={renderHistory} closeButton={true} placement="bottom-start" shouldClose={shouldClose}>
          <IconButton name="history" aria-label="history" />
        </Toggletip>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  history: css``,
  historyItem: css``,
});
