import { useAssistant, createAssistantContextItem } from "@grafana/assistant";
import { CoreApp, DataSourceApi, DataSourceInstanceSettings } from "@grafana/data";
import { t } from "@grafana/i18n";
import { evaluateBooleanFlag } from "@grafana/runtime/internal";
import { DataQuery, DataSourceJsonData } from "@grafana/schema";
import { Button } from "@grafana/ui";
import { queryIsEmpty } from "app/core/utils/query";


interface QueryActionAssistantButtonProps<TQuery extends DataQuery = DataQuery> {
    query: TQuery;
    queries: TQuery[];
    dataSourceInstance: DataSourceInstanceSettings;
    app?: CoreApp;
    datasource: DataSourceApi<TQuery, DataSourceJsonData, {}> | null;
  }
  
  export function QueryActionAssistantButton<TQuery extends DataQuery = DataQuery>({
    query,
    queries,
    dataSourceInstance,
    app,
    datasource,
  }: QueryActionAssistantButtonProps<TQuery>) {
    const { isAvailable, openAssistant } = useAssistant();
    
    // Check if the feature toggle is enabled
    if (!evaluateBooleanFlag('queryWithAssistant', false)) {
      return null;
    }
    
    if (!isAvailable || !openAssistant) {
      return null;
    }
  
    // Only show for Explore and Dashboard apps
    if (app !== CoreApp.Explore && app !== CoreApp.Dashboard && app !== CoreApp.PanelEditor) {
      return null;
    }
  
    // Only show for loki and prometheus datasources
    const pluginId = dataSourceInstance.type;
    if (pluginId !== 'loki' && pluginId !== 'prometheus') {
      return null;
    }
    const origin = `grafana/query-editor/${pluginId}/${app ?? CoreApp.Unknown}`;
    
    // Check if current query has content
    const hasCurrentQuery = !queryIsEmpty(query);
    const otherQueries = queries.filter((q) => q.refId !== query.refId && !queryIsEmpty(q));
    
    // Build context items
    const context = [
      createAssistantContextItem('datasource', {
        datasourceUid: dataSourceInstance.uid,
      }),
    ];
  
    // Add current query if it has content
    if (hasCurrentQuery) {
      context.push(
        createAssistantContextItem('structured', {
          title: t('query-operation.header.current-query', 'Current query'),
          data: query,
        })
      );
    }
  
    // Add other queries if they exist
    if (otherQueries.length > 0) {
      context.push(
        createAssistantContextItem('structured', {
          title: t('query-operation.header.other-queries', 'Other queries'),
          data: {
            queries: otherQueries,
          },
        })
      );
    }
  
    // Get query display text to determine if we're creating or updating
    const queryDisplayText = hasCurrentQuery && datasource?.getQueryDisplayText 
      ? datasource.getQueryDisplayText(query) 
      : null;
    
    // Determine if we're creating or updating based on queryDisplayText
    const isUpdating = !!queryDisplayText;
    const actionText = isUpdating 
      ? t('query-operation.header.assistant-prompt-update', 'Help me update the current query to answer my questions and provide the insights I need.')
      : t('query-operation.header.assistant-prompt-create', 'Help me create a new query to answer my questions and provide the insights I need.');
    
    // Format app name nicely
    const appName = app === CoreApp.Explore 
      ? t('query-operation.header.app-explore', 'Explore')
      : app === CoreApp.Dashboard
      ? t('query-operation.header.app-dashboard', 'Dashboard')
      : '';
    
    // Build the prompt with proper formatting
    const codeBlockLines: string[] = [];
    
    if (queryDisplayText) {
      codeBlockLines.push(
        t('query-operation.header.current-query-label', 'Current query:') + ` ${queryDisplayText}`
      );
    }
    
    codeBlockLines.push(
      t('query-operation.header.selected-datasource-label', 'Selected data source:') + ` ${dataSourceInstance.name}`
    );
    
    if (appName) {
      codeBlockLines.push(
        t('query-operation.header.app-label', 'App:') + ` ${appName}`
      );
    }
    
    // Add actionable sentence to motivate users
    const actionableSentence = isUpdating
      ? t('query-operation.header.assistant-actionable-update', 'Please describe what you want to change or improve in this query.')
      : t('query-operation.header.assistant-actionable-create', 'Please describe what you want to query and what insights you\'re looking for.');
    
    // Build final prompt with code block
    const prompt = [
      actionText,
      '```',
      ...codeBlockLines,
      '```',
      actionableSentence,
    ].join('\n');
  
    const handleClick = () => {
      openAssistant({
        origin,
        prompt,
        context,
        autoSend: false,
      });
    };

    return (
      <Button
        size="sm"
        variant="secondary"
        icon="ai"
        onClick={handleClick}
        title={t('query-operation.header.query-with-assistant', 'Query with Assistant')}
      >
        {t('query-operation.header.query-with-assistant', 'Query with Assistant')}
      </Button>
    );
  }
