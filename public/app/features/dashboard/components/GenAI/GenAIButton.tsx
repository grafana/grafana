import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2 } from '@grafana/ui';

interface GenAIButtonProps {
  text: string;
  onClick: () => void;
  loading?: boolean;
}

export const GenAIButton = ({ text, onClick, loading }: GenAIButtonProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {loading && <Spinner size={14} />}
      <Button icon={!loading ? 'ai' : undefined} onClick={onClick} fill="text" size="sm" disabled={loading}>
        {text}
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
  `,
});
