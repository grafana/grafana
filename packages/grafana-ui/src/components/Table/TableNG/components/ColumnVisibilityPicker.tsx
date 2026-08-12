import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useRef, useState } from 'react';

import { type Field, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Button } from '../../../Button/Button';
import { Checkbox } from '../../../Forms/Checkbox';
import { Stack } from '../../../Layout/Stack/Stack';
import { Popover } from '../../../Tooltip/Popover';
import { getDisplayName } from '../utils';

interface ColumnVisibilityPickerProps {
  fields: Field[];
  hiddenColumns: ReadonlySet<string>;
  onToggleColumn: (displayName: string, visible: boolean) => void;
}

export function ColumnVisibilityPicker({ fields, hiddenColumns, onToggleColumn }: ColumnVisibilityPickerProps) {
  const styles = useStyles2(getStyles);
  const hiddenCount = hiddenColumns.size;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isPopoverVisible, setPopoverVisible] = useState(false);

  if (hiddenCount === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <Button
        ref={buttonRef}
        size="sm"
        variant="secondary"
        fill="outline"
        aria-haspopup="dialog"
        aria-expanded={isPopoverVisible}
        onClick={() => setPopoverVisible((visible) => !visible)}
      >
        <Trans i18nKey="grafana-ui.table.columns-hidden-pill">Columns ({{ hiddenCount }} hidden)</Trans>
      </Button>
      {isPopoverVisible && buttonRef.current && (
        <Popover
          show
          placement="bottom-start"
          referenceElement={buttonRef.current}
          content={
            <div
              className={styles.panel}
              role="dialog"
              aria-label={t('grafana-ui.table.column-visibility', 'Column visibility')}
            >
              <Stack direction="column" gap={0.5}>
                {fields.map((field) => {
                  const displayName = getDisplayName(field);
                  const isVisible = !hiddenColumns.has(displayName);
                  const visibleCount = fields.length - hiddenColumns.size;
                  const isLastVisible = isVisible && visibleCount <= 1;

                  return (
                    <Checkbox
                      key={displayName}
                      label={displayName}
                      value={isVisible}
                      disabled={isLastVisible}
                      onChange={(ev) => onToggleColumn(displayName, ev.currentTarget.checked)}
                    />
                  );
                })}
              </Stack>
            </div>
          }
        />
      )}
    </div>
  );
}

const getStyles = memoize((theme: GrafanaTheme2) => ({
  container: css({
    label: 'columnVisibilityPicker',
    display: 'flex',
    justifyContent: 'flex-end',
    paddingBlockEnd: theme.spacing(0.5),
  }),
  panel: css({
    label: 'columnVisibilityPanel',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    maxHeight: 320,
    overflowY: 'auto',
    padding: theme.spacing(1),
    minWidth: 200,
  }),
}));
