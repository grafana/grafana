import React from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, Button, HorizontalGroup, useTheme } from '@grafana/ui';

type Props = {
  addQueryRowButtonDisabled?: boolean;
  addQueryRowButtonHidden?: boolean;
  richHistoryButtonActive?: boolean;
  queryInspectorButtonActive?: boolean;

  onClickAddQueryRowButton: () => void;
  onClickRichHistoryButton: () => void;
  onClickQueryInspectorButton: () => void;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    containerMargin: css`
      margin-top: ${theme.spacing.md};
    `,
  };
});
export function SecondaryActions(props: Props) {
  const theme = useTheme();
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
        <Button
          variant="secondary"
          aria-label="Rich history button"
          className={cx({ ['explore-active-button']: props.richHistoryButtonActive })}
          onClick={props.onClickRichHistoryButton}
          icon="history"
        >
          Query history
        </Button>
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
