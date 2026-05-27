import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';

import { ActiveFields } from './ActiveFields';
import { AvailableFields } from './AvailableFields';
import { type FieldWithStats } from './FieldSelector';

interface Props {
  activeFields: string[];
  clear: () => void;
  fields: FieldWithStats[];
  logLevelActive?: boolean;
  reorder: (columns: string[]) => void;
  suggestedFields: FieldWithStats[];
  toggle: (columnName: string) => void;
  toggleLevel?: () => void;
}

export const FieldList = ({
  activeFields,
  clear,
  fields,
  logLevelActive,
  reorder,
  suggestedFields,
  toggle,
  toggleLevel,
}: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.sidebarWrap}>
      {/* Sidebar columns */}
      <>
        <ActiveFields
          activeFields={activeFields}
          clear={clear}
          fields={fields}
          logLevelActive={logLevelActive}
          reorder={reorder}
          suggestedFields={suggestedFields}
          toggle={toggle}
          toggleLevel={toggleLevel}
        />

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
      overflowY: 'auto',
      flex: 1,
      scrollbarWidth: 'thin',
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
