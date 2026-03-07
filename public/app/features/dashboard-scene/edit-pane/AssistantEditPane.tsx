import { css } from '@emotion/css';
import { useEffect, useMemo, useRef } from 'react';

import { createAssistantContextItem, useProvidePageContext } from '@grafana/assistant';
import { GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { usePluginComponents } from '@grafana/runtime';
import { useSceneObjectState, VizPanel } from '@grafana/scenes';
import { Spinner, Text, useStyles2 } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';

import { DashboardEditPane } from './DashboardEditPane';
import { ElementSelection } from './ElementSelection';

const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';
const ASSISTANT_PLUGIN_TITLE = 'Grafana Assistant';

interface Props {
  editPane: DashboardEditPane;
  dashboard: DashboardScene;
}

export function AssistantEditPaneContent({ editPane, dashboard }: Props) {
  const styles = useStyles2(getStyles);
  const { assistantState, selection } = useSceneObjectState(editPane);

  const { components, isLoading } = usePluginComponents<Record<string, unknown>>({
    extensionPointId: PluginExtensionPoints.ExtensionSidebar,
  });

  const selectionContext = useMemo(() => buildSelectionContext(selection, dashboard), [selection, dashboard]);

  useProvidePageContext(/.*/, selectionContext);

  const initialPrompt = assistantState?.initialPrompt;
  const initialContext = assistantState?.initialContext;
  const conversationKey = assistantState?.conversationKey;

  const AssistantComponent = useMemo(
    () =>
      isLoading
        ? undefined
        : components.find((c) => c.meta.pluginId === ASSISTANT_PLUGIN_ID && c.meta.title === ASSISTANT_PLUGIN_TITLE),
    [components, isLoading]
  );

  // Track prompt delivery via ref to avoid triggering a re-render that would
  // cause MemoizedDash to see initialPrompt disappear and write an empty prompt
  // to the pending store (cancelling the real one). Persist to scene state only
  // on unmount so tab-switching doesn't re-deliver.
  const promptDeliveredRef = useRef(assistantState?.promptDelivered ?? false);

  const prevKeyRef = useRef(conversationKey);
  if (conversationKey !== prevKeyRef.current) {
    prevKeyRef.current = conversationKey;
    promptDeliveredRef.current = false;
  }

  const isReady = !isLoading && !!AssistantComponent;
  const shouldDeliverPrompt = !!initialPrompt && !promptDeliveredRef.current && isReady;
  if (shouldDeliverPrompt) {
    promptDeliveredRef.current = true;
  }

  useEffect(() => {
    return () => {
      if (
        promptDeliveredRef.current &&
        editPane.state.assistantState &&
        !editPane.state.assistantState.promptDelivered
      ) {
        editPane.setState({
          assistantState: { ...editPane.state.assistantState, promptDelivered: true },
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (!AssistantComponent) {
    return (
      <div className={styles.unavailable}>
        <Text color="secondary">
          <Trans i18nKey="dashboard.assistant-pane.unavailable">Grafana Assistant plugin is not available.</Trans>
        </Text>
      </div>
    );
  }

  const props: Record<string, unknown> = {
    initialMode: 'dashboarding',
    origin: 'dashboard/edit-pane',
  };

  if (shouldDeliverPrompt) {
    props.initialPrompt = initialPrompt;
    props.initialAutoSend = true;
    props.initialContext = initialContext;
  }

  const key = conversationKey ?? 'default';

  return (
    <div className={styles.container}>
      <AssistantComponent key={key} {...props} />
    </div>
  );
}

function buildSelectionContext(
  selection: ElementSelection | undefined,
  dashboard: DashboardScene
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  if (!selection) {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const context: any[] = [];

  for (const [, ref] of selection.getSelectionEntries()) {
    const obj = ref.resolve();
    if (!obj || obj === dashboard || !(obj instanceof VizPanel)) {
      continue;
    }

    const panelKey = obj.state.key;
    const panelId = panelKey?.replace('panel-', '');
    context.push(
      createAssistantContextItem('structured', {
        data: {
          name: `Panel: ${obj.state.title || 'Untitled panel'}`,
          panelId,
          panelKey,
        },
      })
    );
  }

  return context;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }),
    loading: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    }),
    unavailable: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: theme.spacing(4),
      textAlign: 'center',
    }),
  };
}
