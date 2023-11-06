import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2, Tooltip, Toggletip, Text } from '@grafana/ui';

import { DashboardModel } from '../../state';

import { GenAIHistory } from './GenAIHistory';
import { StreamStatus, DiffSummaryMessages, useDiffSummaryHook } from './hooks';
import { AutoGenerateItem, EventTrackingSrc, reportAutoGenerateInteraction } from './tracking';
import { getDashboardChanges, OAI_MODEL, sanitizeReply, Role } from './utils';

const CHANGES_GENERATION_PREFIX_PROMPT = [
  'You are an expert in Grafana Dashboards',
  'Your goal is to write a description of the changes for a dashboard to display to the user',
  'You will be given human-readable diffs with most irrelevant lines filtered out',
].join('.\n');

const CHANGES_GENERATION_POSTFIX_PROMPT = [
  `Respond only with the diff description, which is meant to be loaded directly into the application for the user.`,
  `If there are no substantial changes, the correct description is "Minor changes only"`,
  `If the changes are listed as "Changes too long to summarize", the correct response for that section is "Too many changes to auto-summarize"`,
  'In a diff, lines beginning with - are removed, and lines beginning with + are added.',
  'Lines with neither + nor - are included for context. Be careful not to mark them as added or removed if they do not start with + or -.',
  'If a line is changed, it will show a previous version removed and a new version added',
  'When referring to panel changes, use the panel title',
  'When using panel title, wrap it with double quotes',
  'When the panel changes position, just mention that the panel has changed position',
  'When an entire panel is added or removed, use the panel title and only say it was added or removed and disregard the rest of the changes for that panel',
  'Group together similar changes into one line when multiple panels are affected',
  'Refer to templating elements as variables',
  'Ignore any threshold step changes or templating list changes.',
  'Try to make the response as short as possible',
].join('.\n');

interface GenAIButtonProps {
  // Button label text
  text?: string;
  // Button label text when loading
  loadingText?: string;
  toggleTipTitle?: string;
  // Button click handler
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  // Callback function that the LLM plugin streams responses to
  onGenerate: (response: string) => void;
  // Temperature for the LLM plugin. Default is 1.
  // Closer to 0 means more conservative, closer to 1 means more creative.
  temperature?: number;
  model?: OAI_MODEL;
  // Event tracking source. Send as `src` to Rudderstack event
  eventTrackingSrc?: EventTrackingSrc;
  // Whether the button should be disabled
  disabled?: boolean;
  dashboard: DashboardModel;
}

// This currently duplicates much of the functionality in GenAIButton
// This was necessary because the GenAIButton only allows one call
// to the LLM plugin, and we need to call it twice for the dashboard
export const GenAIDashboardChangesButton = ({
  text = 'Auto-generate',
  loadingText = 'Generating changes summary',
  onClick: onClickProp,
  model = 'gpt-3.5-turbo-16k',
  onGenerate,
  temperature = 0,
  eventTrackingSrc = EventTrackingSrc.dashboardChanges,
  disabled = false,
  dashboard,
}: GenAIButtonProps) => {
  const messages = useMemo(() => getMessages(dashboard), [dashboard]);

  const styles = useStyles2(getStyles);

  const { setMessages, reply, value, error, streamStatus } = useDiffSummaryHook(model, temperature);

  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  const hasHistory = history.length > 0;
  const isFirstHistoryEntry = streamStatus === StreamStatus.GENERATING && !hasHistory;
  const isButtonDisabled = disabled || isFirstHistoryEntry || (value && !value.enabled && !error);
  const reportInteraction = (item: AutoGenerateItem) => reportAutoGenerateInteraction(eventTrackingSrc, item);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClickProp?.(e);
    setMessages(messages);
    const buttonItem = error
      ? AutoGenerateItem.erroredRetryButton
      : hasHistory
      ? AutoGenerateItem.improveButton
      : AutoGenerateItem.autoGenerateButton;
    reportInteraction(buttonItem);
  };

  const pushHistoryEntry = useCallback(
    (historyEntry: string) => {
      if (history.indexOf(historyEntry) === -1) {
        setHistory([historyEntry, ...history]);
      }
    },
    [history]
  );

  useEffect(() => {
    // Todo: Consider other options for `"` sanitation
    if (isFirstHistoryEntry && reply) {
      onGenerate(sanitizeReply(reply));
    }
  }, [streamStatus, reply, onGenerate, isFirstHistoryEntry]);

  useEffect(() => {
    if (streamStatus === StreamStatus.COMPLETED) {
      pushHistoryEntry(sanitizeReply(reply));
    }
  }, [history, streamStatus, reply, pushHistoryEntry]);

  // The button is disabled if the plugin is not installed or enabled
  if (!value?.enabled) {
    return null;
  }

  const onApplySuggestion = (suggestion: string) => {
    reportInteraction(AutoGenerateItem.applySuggestion);
    onGenerate(suggestion);
    setShowHistory(false);
  };

  const getIcon = () => {
    if (isFirstHistoryEntry) {
      return undefined;
    }
    if (error || (value && !value?.enabled)) {
      return 'exclamation-circle';
    }
    return 'ai';
  };

  const getText = () => {
    let buttonText = text;

    if (error) {
      buttonText = 'Retry';
    }

    if (isFirstHistoryEntry) {
      buttonText = loadingText;
    }

    if (hasHistory) {
      buttonText = 'Improve';
    }

    return buttonText;
  };

  const button = (
    <Button
      icon={getIcon()}
      onClick={onClick}
      fill="text"
      size="sm"
      disabled={isButtonDisabled}
      variant={error ? 'destructive' : 'primary'}
    >
      {getText()}
    </Button>
  );

  function getMessages(dashboard: DashboardModel): DiffSummaryMessages {
    let { userChanges, migrationChanges } = getDashboardChanges(dashboard);
    if (userChanges.length > 8000) {
      userChanges = 'Changes too long to summarize';
    }

    if (migrationChanges.split('\n').length < 10) {
      migrationChanges = 'No significant migration changes';
    } else if (migrationChanges.length > 8000) {
      migrationChanges = 'Changes too long to summarize';
    }

    const userMessages = [
      {
        content: CHANGES_GENERATION_PREFIX_PROMPT,
        role: Role.system,
      },
      {
        content: `Summarize the following user changes diff with one item per line:\n${userChanges}`,
        role: Role.system,
      },
      {
        content: CHANGES_GENERATION_POSTFIX_PROMPT,
        role: Role.system,
      },
    ];

    const migrationMessages = [
      {
        content: CHANGES_GENERATION_PREFIX_PROMPT,
        role: Role.system,
      },
      {
        content: `Summarize the following migration changes diff with one item per line:\n${migrationChanges}`,
        role: Role.system,
      },
      {
        content:
          `Be sure to only include substantial migration changes, such as adding or removing entire panels, changing panel titles or descriptions, etc.\n` +
          `Ignore other changes and do not include them in the summary. Do not include "Migration Changes" section if there are no substantial migration changes to report.\n` +
          `If there are substantial migration changes, add "Some autogenerated changes are included to update the dashboard to the latest valid schema version" at the end.`,
        role: Role.system,
      },
      {
        content: CHANGES_GENERATION_POSTFIX_PROMPT,
        role: Role.system,
      },
    ];

    return { userMessages, migrationMessages };
  }

  const renderButtonWithToggletip = () => {
    if (hasHistory) {
      const title = <Text element="p">{'Improve the dashboard summary'}</Text>;

      return (
        <Toggletip
          title={title}
          content={
            <GenAIHistory
              history={history}
              messages={[...messages.userMessages, ...messages.migrationMessages]}
              onApplySuggestion={onApplySuggestion}
              updateHistory={pushHistoryEntry}
              eventTrackingSrc={eventTrackingSrc}
            />
          }
          placement="bottom-start"
          fitContent={true}
          show={showHistory ? undefined : false}
        >
          {button}
        </Toggletip>
      );
    }

    return button;
  };

  return (
    <div className={styles.wrapper}>
      {isFirstHistoryEntry && <Spinner size="sm" />}
      {!hasHistory && (
        <Tooltip
          show={error ? undefined : false}
          interactive
          content={
            'Failed to generate content using OpenAI. Please try again or if the problem persist, contact your organization admin.'
          }
        >
          {button}
        </Tooltip>
      )}
      {hasHistory && renderButtonWithToggletip()}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
  }),
});
