import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { PanelModel } from '../../state';

interface PanelSuggestionsProps {
  suggestions: PanelModel[];
  onDismiss: () => void;
}

export const PanelSuggestions = ({ suggestions, onDismiss }: PanelSuggestionsProps) => {
  const styles = useStyles2(getStyles);

  const dashboard = getDashboardSrv().getCurrent();

  const onUseSuggestion = (panel: any) => {
    dashboard?.addPanel(panel);
    onDismiss();
  };

  return (
    <div className={styles.wrapper}>
      {suggestions.map((panel, index) => (
        // TODO: fix keyboard a11y
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div key={index} onClick={() => onUseSuggestion(panel)} className={styles.suggestion}>
          <div className={styles.suggestionContent}>{panel.title ?? 'Untitled'}</div>
        </div>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    margin-top: ${theme.spacing(2)};
    gap: ${theme.spacing(3)};
    margin-bottom: ${theme.spacing(3)};
  `,
  suggestion: css`
    height: 185px;
    border-radius: 2px;
    border: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.secondary};
    cursor: pointer;
  `,
  suggestionContent: css`
    padding: ${theme.spacing(2)};
  `,
});
