import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { PanelChrome, useStyles2 } from '@grafana/ui';

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
          <PanelChrome
            title={panel.title ?? 'Untitled'}
            description={panel.description}
            width={800}
            height={185}
            key={index}
          >
            {(width: number, height: number) => <div style={{ height, width }}>Panel in a loading state</div>}
          </PanelChrome>
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
    cursor: pointer;
  `,
  suggestionContent: css`
    padding: ${theme.spacing(2)};
  `,
});
