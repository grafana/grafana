import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { ToolbarButton, ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { TabItem } from './TabItem';

interface Props {
  model: TabItem;
}

export function TabItemAffix({ model }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <ToolbarButtonRow className={styles.container}>
      {!model.isFirstTab() && (
        <ToolbarButton
          aria-label={t('dashboard.tabs-layout.tab.affix.move-left', 'Move left')}
          title={t('dashboard.tabs-layout.tab.affix.move-left', 'Move left')}
          icon="arrow-left"
          iconSize="xs"
          variant="canvas"
          onClick={() => model.onMoveLeft()}
        />
      )}
    </ToolbarButtonRow>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      marginRight: theme.spacing(1),
    }),
  };
}
