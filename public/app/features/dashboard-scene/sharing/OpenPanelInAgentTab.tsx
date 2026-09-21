import { Trans, t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectRef, type VizPanel } from '@grafana/scenes';
import {
  Alert,
  Button,
  ClipboardButton,
  ControlledCollapse,
  Field,
  LinkButton,
  Stack,
  Text,
  TextArea,
} from '@grafana/ui';
import { HANDOFF_AGENTS, markAgentSetupSeen } from 'app/features/agent-handoff/agents';
import {
  buildCursorMcpInstallDeeplink,
  claudeMcpAddCommand,
  grafanaUrlForAgent,
  mcpInstallCommand,
  TOKEN_ENV_VAR,
} from 'app/features/agent-handoff/connect';
import { type AgentId, openAgentPromptDeeplink } from 'app/features/agent-handoff/deeplinks';
import { buildPanelHandoffPrompt } from 'app/features/agent-handoff/handoffPrompt';
import { panelHandoffFor } from 'app/features/agent-handoff/panelHandoff';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { type SceneShareTabState } from './types';

export interface OpenPanelInAgentTabState extends SceneShareTabState {
  panelRef: SceneObjectRef<VizPanel>;
}

/**
 * The setup step behind "Open in ›".
 *
 * A menu item that only fires a protocol handler cannot report anything: an agent
 * that is not installed swallows the link silently, and one that is installed but has
 * no Grafana MCP server connected opens a session that can do nothing with the
 * prompt. This drawer is where those two are explained once, and it is what the menu
 * opens until the user has been through it.
 */
export class OpenPanelInAgentTab extends SceneObjectBase<OpenPanelInAgentTabState> {
  public tabId = shareDashboardType.openInAgent;
  static Component = OpenPanelInAgentTabRenderer;

  public getTabLabel() {
    return t('share-panel.drawer.open-in-agent-title', 'Open in a coding agent');
  }

  public getSubtitle() {
    return t(
      'share-panel.drawer.open-in-agent-subtitle',
      'Hand this panel to an agent running on your machine. It queries Grafana itself and renders the panel in its own window.'
    );
  }
}

function OpenPanelInAgentTabRenderer({ model }: SceneComponentProps<OpenPanelInAgentTab>) {
  const { panelRef } = model.useState();
  const panel = panelRef.resolve();
  const dashboard = getDashboardSceneFor(model);
  const prompt = buildPanelHandoffPrompt(panelHandoffFor(panel, dashboard.state.uid ?? ''));

  const onOpen = (agentId: AgentId) => {
    markAgentSetupSeen(agentId);
    DashboardInteractions.sharingCategoryClicked({
      item: shareDashboardType.openInAgent,
      agent: agentId,
      shareResource: 'panel',
    });
    openAgentPromptDeeplink(agentId, prompt);
  };

  return (
    <Stack direction="column" gap={3}>
      <Stack direction="column" gap={1}>
        <Text element="h4">
          <Trans i18nKey="share-panel.open-in-agent.step-one">1. Install the Grafana MCP server, once</Trans>
        </Text>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="share-panel.open-in-agent.install-description">
            The agent talks to Grafana through this server, which runs on your machine. Neither agent checks that the
            command exists, so an agent registered without it fails on every call.
          </Trans>
        </Text>
        <Stack gap={1} alignItems="start">
          <TextArea
            rows={2}
            readOnly
            aria-label={t('share-panel.open-in-agent.install-label', 'Install command')}
            value={mcpInstallCommand()}
            onClick={(event) => event.currentTarget.select()}
          />
          <ClipboardButton icon="copy" variant="secondary" getText={mcpInstallCommand}>
            <Trans i18nKey="share-panel.open-in-agent.copy-install">Copy</Trans>
          </ClipboardButton>
        </Stack>
      </Stack>

      <Stack direction="column" gap={1}>
        <Text element="h4">
          <Trans i18nKey="share-panel.open-in-agent.step-two">2. Register it with your agent, once</Trans>
        </Text>

        <Field
          noMargin
          label={t('share-panel.open-in-agent.cursor-label', 'Cursor')}
          description={t(
            'share-panel.open-in-agent.cursor-description',
            'Opens Cursor and adds the server to its configuration.'
          )}
        >
          <LinkButton variant="secondary" icon="external-link-alt" href={buildCursorMcpInstallDeeplink()}>
            <Trans i18nKey="share-panel.open-in-agent.cursor-install">Add the Grafana MCP server to Cursor</Trans>
          </LinkButton>
        </Field>

        <Field
          noMargin
          label={t('share-panel.open-in-agent.claude-label', 'Claude Code')}
          description={t(
            'share-panel.open-in-agent.claude-description',
            'Claude has no install link, so this is a command to run once. It registers the server for every session, not just the directory you run it in.'
          )}
        >
          <Stack gap={1} alignItems="start">
            <TextArea
              // Three, not two: the command wraps to three lines at drawer width and a
              // clipped last line reads as a complete command that silently does less.
              rows={3}
              readOnly
              aria-label={t('share-panel.open-in-agent.claude-label', 'Claude Code')}
              value={claudeMcpAddCommand()}
              onClick={(event) => event.currentTarget.select()}
            />
            <ClipboardButton icon="copy" variant="secondary" getText={claudeMcpAddCommand}>
              <Trans i18nKey="share-panel.open-in-agent.copy-command">Copy</Trans>
            </ClipboardButton>
          </Stack>
        </Field>

        <Alert
          severity="info"
          title={t('share-panel.open-in-agent.token-title', 'Both of these reference a token rather than carrying one')}
        >
          <Trans
            i18nKey="share-panel.open-in-agent.token-description"
            values={{ envVar: TOKEN_ENV_VAR, url: grafanaUrlForAgent() }}
          >
            They point the server at {'{{url}}'} and read your service account token from {'{{envVar}}'} in the
            agent&apos;s environment. Create a token on the service accounts page and set it there; Grafana never puts
            it in a link.
          </Trans>
        </Alert>
      </Stack>

      <Stack direction="column" gap={1}>
        <Text element="h4">
          <Trans i18nKey="share-panel.open-in-agent.step-three">3. Open this panel</Trans>
        </Text>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="share-panel.open-in-agent.open-description">
            The agent opens with a prompt naming this panel and the time range. Nothing is sent until you submit it
            there.
          </Trans>
        </Text>
        <Stack gap={1}>
          {HANDOFF_AGENTS.map(({ id, name }) => (
            <Button key={id} variant="secondary" icon="external-link-alt" onClick={() => onOpen(id)}>
              {name}
            </Button>
          ))}
        </Stack>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="share-panel.open-in-agent.where-it-draws">
            Cursor and the Claude Code desktop app draw the panel itself. Other surfaces, the Claude Code terminal among
            them, get a text summary instead.
          </Trans>
        </Text>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="share-panel.open-in-agent.undetectable">
            If the agent is not installed, your browser ignores the link without an error. Grafana cannot tell the
            difference, so nothing here will claim it worked.
          </Trans>
        </Text>
      </Stack>

      <ControlledCollapse label={t('share-panel.open-in-agent.show-prompt', 'Show the prompt')} collapsible>
        <TextArea
          rows={10}
          readOnly
          aria-label={t('share-panel.open-in-agent.prompt-label', 'Prompt sent to the agent')}
          value={prompt}
        />
      </ControlledCollapse>
    </Stack>
  );
}
