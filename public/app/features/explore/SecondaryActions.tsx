import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { ToolbarButton, useTheme2 } from '@grafana/ui';

type Props = {
  addQueryRowButtonDisabled?: boolean;
  addQueryRowButtonHidden?: boolean;
  richHistoryRowButtonHidden?: boolean;
  richHistoryButtonActive?: boolean;
  queryInspectorButtonActive?: boolean;

  onClickAddQueryRowButton: () => void;
  onClickRichHistoryButton: () => void;
  onClickQueryInspectorButton: () => void;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    containerMargin: css`
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.spacing(1)};
      margin-top: ${theme.spacing(2)};
    `,
  };
};

export function SecondaryActions(props: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <div className={styles.containerMargin}>
      {!props.addQueryRowButtonHidden && (
        <ToolbarButton
          variant="canvas"
          aria-label="Add query"
          onClick={props.onClickAddQueryRowButton}
          disabled={props.addQueryRowButtonDisabled}
          icon="plus"
        >
          Add query
        </ToolbarButton>
      )}
      {!props.richHistoryRowButtonHidden && (
        <ToolbarButton
          variant={props.richHistoryButtonActive ? 'active' : 'canvas'}
          aria-label="Query history"
          onClick={props.onClickRichHistoryButton}
          data-testid={Components.QueryTab.queryHistoryButton}
          icon="history"
        >
          Query history
        </ToolbarButton>
      )}
      <ToolbarButton
        variant={props.queryInspectorButtonActive ? 'active' : 'canvas'}
        aria-label="Query inspector"
        onClick={props.onClickQueryInspectorButton}
        icon="info-circle"
      >
        Query inspector
      </ToolbarButton>
    </div>
  );
}
