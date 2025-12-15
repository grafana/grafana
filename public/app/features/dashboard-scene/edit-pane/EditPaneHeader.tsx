import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, Sidebar, Stack, useStyles2 } from '@grafana/ui';
import { trackDeleteDashboardElement } from 'app/features/dashboard-scene/utils/tracking';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';

interface EditPaneHeaderProps {
  element: EditableDashboardElement;
}

export function EditPaneHeader({ element }: EditPaneHeaderProps) {
  const styles = useStyles2(getStyles);
  const elementInfo = element.getEditableElementInfo();

  const onCopy = element.onCopy?.bind(element);
  const onDuplicate = element.onDuplicate?.bind(element);
  const onDelete = element.onDelete?.bind(element);
  const onConfirmDelete = element.onConfirmDelete?.bind(element);

  const onDeleteElement = () => {
    if (onConfirmDelete) {
      onConfirmDelete();
    } else if (onDelete) {
      onDelete();
    }
    trackDeleteDashboardElement(elementInfo);
  };

  return (
    <Sidebar.PaneHeader title={elementInfo.typeName}>
      <Stack direction="row" gap={1} justifyContent="space-between">
        <div className={styles.left}>
          {element.renderActions && element.renderActions()}
          {onCopy && (
            <Button
              tooltip={t('dashboard.layout.common.copy', 'Copy')}
              tooltipPlacement="bottom"
              variant="secondary"
              size="sm"
              icon="copy"
              onClick={onCopy}
            />
          )}
          {onDuplicate && (
            <Button
              tooltip={t('dashboard.layout.common.duplicate', 'Duplicate')}
              tooltipPlacement="bottom"
              variant="secondary"
              size="sm"
              icon="file-copy-alt"
              onClick={onDuplicate}
            />
          )}
        </div>
        <div className={styles.right}>
          {(onDelete || onConfirmDelete) && (
            <Button
              onClick={onDeleteElement}
              size="sm"
              variant="destructive"
              fill="outline"
              icon="trash-alt"
              tooltip={t('dashboard.layout.common.delete', 'Delete')}
              data-testid={selectors.components.EditPaneHeader.deleteButton}
            />
          )}
        </div>
      </Stack>
    </Sidebar.PaneHeader>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    left: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexGrow: 1,
    }),
    right: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      justifyContent: 'flex-end',
    }),
  };
};
