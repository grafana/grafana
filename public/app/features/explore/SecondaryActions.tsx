import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, HorizontalGroup, useTheme2 } from '@grafana/ui';

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
      margin-top: ${theme.spacing(2)};
    `,
  };
};
export function SecondaryActions(props: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <div className={styles.containerMargin}>
      <HorizontalGroup>
        {!props.addQueryRowButtonHidden && (
          <Button
            variant="secondary"
            aria-label="Add row button"
            onClick={props.onClickAddQueryRowButton}
            disabled={props.addQueryRowButtonDisabled}
            icon="plus"
          >
            Add query
          </Button>
        )}
        {!props.richHistoryRowButtonHidden && (
          <Button
            variant="secondary"
            aria-label="Rich history button"
            className={cx({ ['explore-active-button']: props.richHistoryButtonActive })}
            onClick={props.onClickRichHistoryButton}
            icon="history"
          >
            Query history
          </Button>
        )}
        <Button
          variant="secondary"
          aria-label="Query inspector button"
          className={cx({ ['explore-active-button']: props.queryInspectorButtonActive })}
          onClick={props.onClickQueryInspectorButton}
          icon="info-circle"
        >
          Inspector
        </Button>
      </HorizontalGroup>
    </div>
  );
}
