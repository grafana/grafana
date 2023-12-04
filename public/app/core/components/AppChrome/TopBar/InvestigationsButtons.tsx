import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Stack, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

interface User {
  name: string;
  photoUrl: string;
}

interface InvestigationsButtonProps {
  count: number;
  collaborators: User[];
}

export const InvestigationsButton = ({ count, collaborators }: InvestigationsButtonProps) => {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();

  const numCollaborators = collaborators.length;

  return (
    <button
      type="button"
      className={styles.button}
      onClick={() => {
        chrome.setExtensionDrawerOpen(true);
        // TODO hard-coded value for the Hackathon
        chrome.setExtensionDrawerTab('-518495969');
      }}
    >
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Icon name="book" /> {count}
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Icon name="users-alt" /> {numCollaborators}
        </Stack>
      </Stack>
    </button>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    background: '#277C3C',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.maxContrast,
  }),
});
