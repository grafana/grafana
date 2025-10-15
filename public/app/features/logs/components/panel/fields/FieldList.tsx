import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';

import { ActiveFields } from './ActiveFields';
import { AvailableFields } from './AvailableFields';
import { FieldWithStats } from './FieldSelector';

interface Props {
  activeFields: string[];
  clear: () => void;
  fields: FieldWithStats[];
  reorder: (columns: string[]) => void;
  toggle: (columnName: string) => void;
}

export const FieldList = ({ activeFields, clear, fields, reorder, toggle }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.sidebarWrap}>
      {/* Sidebar columns */}
      <>
        <div className={styles.columnHeader}>
          <Trans i18nKey="explore.logs-table-multi-select.selected-fields">Selected fields</Trans>
          <button onClick={clear} className={styles.columnHeaderButton}>
            <Trans i18nKey="explore.logs-table-multi-select.reset">Reset</Trans>
          </button>
        </div>
        <ActiveFields activeFields={activeFields} fields={fields} reorder={reorder} toggle={toggle} />

        <div className={styles.columnHeader}>
          <Trans i18nKey="explore.logs-table-multi-select.fields">Fields</Trans>
        </div>
        <AvailableFields activeFields={activeFields} fields={fields} reorder={reorder} toggle={toggle} />
      </>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    sidebarWrap: css({
      overflowY: 'scroll',
      flex: 1,
      /* Hide scrollbar for Chrome, Safari, and Opera */
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      /* Hide scrollbar for Firefox */
      scrollbarWidth: 'none',
    }),
    columnHeaderButton: css({
      appearance: 'none',
      background: 'none',
      border: 'none',
      fontSize: theme.typography.pxToRem(11),
    }),
    columnHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: theme.typography.h6.fontSize,
      background: theme.colors.background.secondary,
      position: 'sticky',
      top: 0,
      left: 0,
      paddingTop: theme.spacing(0.75),
      paddingRight: theme.spacing(0.75),
      paddingBottom: theme.spacing(0.75),
      paddingLeft: theme.spacing(1.5),
      zIndex: 3,
      marginBottom: theme.spacing(2),
    }),
  };
}
