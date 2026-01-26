import { css } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { DataSourcePicker } from '@grafana/runtime';
import { useStyles2, Text, Button, Icon } from '@grafana/ui';
import { InspectTab } from 'app/features/inspector/types';

import { PanelInspectDrawer } from '../../../inspect/PanelInspectDrawer';
import { getDashboardSceneFor } from '../../../utils/utils';
import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../constants';
import { getQueryType } from '../utils';

import { EditableQueryName } from './EditableQueryName';
import { useActionsContext, useDatasourceContext, usePanelContext, useQueryRunnerContext } from './QueryEditorContext';

export function QueryEditorContentHeader() {
  const { dsSettings } = useDatasourceContext();
  const { panel } = usePanelContext();
  const { queries } = useQueryRunnerContext();
  const { changeDataSource, updateSelectedQuery } = useActionsContext();

  // TODO: Replace with selectedQuery from context when selector is ready
  const selectedQuery = queries[0];
  const queryType = getQueryType(panel, selectedQuery);

  const styles = useStyles2(getStyles, { queryType });

  // TODO: Where does this handler belong?
  const onOpenInspector = useCallback(() => {
    const dashboard = getDashboardSceneFor(panel);
    dashboard.showModal(new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab: InspectTab.Query }));
  }, [panel]);

  return (
    <div className={styles.container}>
      <div className={styles.queryHeaderWrapper}>
        <Icon name={QUERY_EDITOR_TYPE_CONFIG[queryType].icon} size="sm" />
        <div className={styles.dataSourcePickerWrapper}>
          <DataSourcePicker current={dsSettings?.uid ?? null} onChange={changeDataSource} />
        </div>
        <Text variant="h4" color="secondary">
          /
        </Text>
        <EditableQueryName query={selectedQuery} queries={queries} onQueryUpdate={updateSelectedQuery} />
      </div>
      <div>
        <Button size="sm" fill="text" icon="code" variant="secondary" onClick={onOpenInspector}>
          <Trans i18nKey="query-editor-next.content-header.inspect-query">Inspector</Trans>
        </Button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, { queryType }: { queryType: QueryEditorType }) => ({
  container: css({
    borderLeft: `4px solid ${QUERY_EDITOR_TYPE_CONFIG[queryType].color}`,
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(0.5),
    borderTopRightRadius: theme.shape.radius.default,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  }),
  queryHeaderWrapper: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: `0 ${theme.spacing(0.5)}`,
  }),
  dataSourcePickerWrapper: css({
    '& .ds-picker': {
      border: 'none',
      backgroundColor: theme.colors.background.secondary,
      '& > div': {
        border: 'none',
      },
    },
  }),
});
