import { css } from '@emotion/css';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { QueryActionAssistantButton } from 'app/features/query/components/QueryActionAssistantButton';

import { QueryEditorType } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';

// https://github.com/grafana/grafana/issues/117808
// This is a hack to get the assistant button to match our normal button styles without
// be able to directly update the QueryActionAssistantButton component. We need to fix this properly.
const getStyles = (theme: GrafanaTheme2) => ({
  // Override the inner button to match <Button size="sm" fill="text" variant="secondary" /> icon-only style
  wrapper: css({
    '& > button, & > div > button': {
      background: 'transparent',
      color: theme.colors.secondary.text,
      border: '1px solid transparent',
      height: theme.spacing(3),
      padding: theme.spacing(0, 0.5),
      gap: 0,
      // Hide the text label, keep the icon
      '& > span': {
        display: 'none',
      },
      '&:hover, &:focus': {
        textDecoration: 'none',
        outline: 'none',
        boxShadow: 'none',
        borderColor: 'transparent',
      },
    },
  }),
});

interface AssistantButtonProps {
  queries: DataQuery[];
}

export function AssistantButton({ queries }: AssistantButtonProps) {
  const styles = useStyles2(getStyles);
  const { selectedQuery, cardType, selectedQueryDsData } = useQueryEditorUIContext();

  // Only show for queries (not expressions or transformations)
  if (cardType !== QueryEditorType.Query) {
    return null;
  }

  // Require datasource settings and selected query
  if (!selectedQueryDsData?.dsSettings || !selectedQuery) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <QueryActionAssistantButton
        app={CoreApp.PanelEditor}
        datasourceApi={selectedQueryDsData.datasource ?? null}
        dataSourceInstanceSettings={selectedQueryDsData.dsSettings}
        queries={queries}
        query={selectedQuery}
      />
    </div>
  );
}
