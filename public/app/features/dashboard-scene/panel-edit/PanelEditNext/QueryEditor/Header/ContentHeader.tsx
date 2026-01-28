import { css } from '@emotion/css';
import { useCallback } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { useStyles2, Icon, Button, Text } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { InspectTab } from 'app/features/inspector/types';

import { PanelInspectDrawer } from '../../../../inspect/PanelInspectDrawer';
import { getDashboardSceneFor } from '../../../../utils/utils';
import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import {
  useActionsContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';

import { EditableQueryName } from './EditableQueryName';

export function ContentHeader() {
  const { panel } = usePanelContext();
  const { selectedCard } = useQueryEditorUIContext();
  const { queries } = useQueryRunnerContext();
  const { changeDataSource, updateSelectedQuery } = useActionsContext();

  // TODO: Add transformation support
  const cardType = isExpressionQuery(selectedCard ?? undefined) ? QueryEditorType.Expression : QueryEditorType.Query;

  const styles = useStyles2(getStyles, { cardType });

  const onOpenInspector = useCallback(() => {
    const dashboard = getDashboardSceneFor(panel);
    dashboard.showModal(new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab: InspectTab.Query }));
  }, [panel]);

  // We have to do defensive null checks since queries might be an empty array :(
  if (!selectedCard) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.queryHeaderWrapper}>
        <Icon name={QUERY_EDITOR_TYPE_CONFIG[cardType].icon} size="sm" />
        {cardType === QueryEditorType.Query && (
          <DatasourceSection selectedCard={selectedCard} onChange={(ds) => changeDataSource(ds, selectedCard.refId)} />
        )}
        <EditableQueryName query={selectedCard} queries={queries} onQueryUpdate={updateSelectedQuery} />
      </div>

      {/* TODO: Will fix up buttons in header actions ticket */}
      <Button
        size="sm"
        fill="text"
        icon="brackets-curly"
        variant="secondary"
        onClick={onOpenInspector}
        tooltip={t('query-editor.action.inspector', 'Query inspector')}
      >
        <Trans i18nKey="query-editor.action.inspector">Inspector</Trans>
      </Button>
    </div>
  );
}

interface DatasourceSectionProps {
  selectedCard: DataQuery;
  onChange: (ds: DataSourceInstanceSettings) => void;
}

function DatasourceSection({ selectedCard, onChange }: DatasourceSectionProps) {
  const styles = useStyles2(getDatasourceSectionStyles);

  return (
    <>
      <div className={styles.dataSourcePickerWrapper}>
        <DataSourcePicker dashboard={true} variables={true} current={selectedCard.datasource} onChange={onChange} />
      </div>
      <Text variant="h4" color="secondary">
        /
      </Text>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2, { cardType }: { cardType: QueryEditorType }) => ({
  container: css({
    borderLeft: `4px solid ${QUERY_EDITOR_TYPE_CONFIG[cardType].color}`,
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(0.5),
    borderTopLeftRadius: theme.shape.radius.default,
    borderTopRightRadius: theme.shape.radius.default,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    minHeight: theme.spacing(5),
  }),
  queryHeaderWrapper: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: `0 ${theme.spacing(0.5)}`,
  }),
});

const getDatasourceSectionStyles = (theme: GrafanaTheme2) => ({
  dataSourcePickerWrapper: css({
    // Target the Input component inside the picker
    input: {
      border: 'none',
      backgroundColor: theme.colors.background.secondary,
    },
    // Remove borders from all nested divs
    '& > div, & div': {
      border: 'none',
    },
  }),
});
