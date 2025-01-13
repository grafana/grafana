import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { ToolbarButton, useTheme2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

type Props = {
  addQueryRowButtonDisabled?: boolean;
  addQueryRowButtonHidden?: boolean;
  richHistoryRowButtonHidden?: boolean;
  queryInspectorButtonActive?: boolean;

  onClickAddQueryRowButton: () => void;
  onClickQueryInspectorButton: () => void;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    containerMargin: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginTop: theme.spacing(2),
    }),
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
          aria-label={t('explore.secondary-actions.query-add-button-aria-label', 'Add query')}
          onClick={props.onClickAddQueryRowButton}
          disabled={props.addQueryRowButtonDisabled}
          icon="plus"
        >
          <Trans i18nKey="explore.secondary-actions.query-add-button">Add query</Trans>
        </ToolbarButton>
      )}
      <ToolbarButton
        variant={props.queryInspectorButtonActive ? 'active' : 'canvas'}
        aria-label={t('explore.secondary-actions.query-inspector-button-aria-label', 'Query inspector')}
        onClick={props.onClickQueryInspectorButton}
        icon="info-circle"
      >
        <Trans i18nKey="explore.secondary-actions.query-inspector-button">Query inspector</Trans>
      </ToolbarButton>
    </div>
  );
}
