import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { BulkEditableDashboardElements } from '../scene/types';

export interface Props {
  bulkEditElement: BulkEditableDashboardElements;
}

export function MultiSelectedElementsEditPane({ bulkEditElement }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={0}>
      {bulkEditElement.renderBulkActions && (
        <OptionsPaneCategory
          id="selected-item"
          title={bulkEditElement.getTypeName()}
          isOpenDefault={true}
          className={styles.noBorderTop}
        >
          <div className={styles.actionsBox}>{bulkEditElement.renderBulkActions()}</div>
        </OptionsPaneCategory>
      )}
      {/* {categories.map((cat) => cat.render())} */}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    noBorderTop: css({
      borderTop: 'none',
    }),
    actionsBox: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    }),
  };
}
