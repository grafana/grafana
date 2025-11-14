import { css } from '@emotion/css';
import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, Input, LinkButton, measureText, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';

import { getPathOfNode } from './scopesTreeUtils';
import { NodesMap, ScopesMap, SelectedScope } from './types';
import { useScopeNode } from './useScopeNode';

export interface ScopesInputProps {
  nodes: NodesMap;
  scopes: ScopesMap;
  appliedScopes: SelectedScope[];
  disabled: boolean;
  loading: boolean;
  onInputClick: () => void;
  onRemoveAllClick: () => void;
}

/**
 * Shows the applied scopes in an input like element which opens the scope selector when clicked.
 */
export function ScopesInput({
  nodes,
  scopes,
  appliedScopes,
  disabled,
  loading,
  onInputClick,
  onRemoveAllClick,
}: ScopesInputProps) {
  const scopeNodeId = appliedScopes[0]?.scopeNodeId;
  const parentNodeIdFromUrl = appliedScopes[0]?.parentNodeId;
  const styles = useStyles2(getStyles);
  const { node: scopeNode, isLoading: scopeNodeLoading } = useScopeNode(scopeNodeId);
  const theme = useTheme2();

  // Get parent from scope node if available, otherwise use parentNodeId from URL (for backward compatibility)
  const parentNodeId = scopeNode?.spec.parentName ?? parentNodeIdFromUrl;
  const { node: parentNode, isLoading: parentNodeLoading } = useScopeNode(parentNodeId);

  // Prioritize scope node subtitle over parent node title
  const displayTitle = scopeNode?.spec.subTitle ?? parentNode?.spec.title ?? 'Loki';
  const isLoadingTitle = scopeNodeLoading || parentNodeLoading;
  const placeholderText = t('scopes.selector.input.placeholder', 'No scopes');

  const tooltipContent =
    appliedScopes.length > 0 ? (
      <>
        <ScopesTooltip nodes={nodes} scopes={scopes} appliedScopes={appliedScopes} />
        <LinkButton
          onClick={onRemoveAllClick}
          aria-label={t('scopes.selector.input.removeAll', 'Remove all scopes')}
          name="times"
          data-testid="scopes-selector-input-clear"
          size="sm"
          fill="text"
        >
          <Trans i18nKey="scopes.selector.input.remove-all">Remove all</Trans>
        </LinkButton>
      </>
    ) : (
      t('scopes.selector.input.tooltip', 'Select scope')
    );

  const scopesTitles = useMemo(
    () =>
      appliedScopes
        .map(
          (s) =>
            // If we are still loading the scope data just show the id
            scopes[s.scopeId]?.spec.title || s.scopeId
        )
        .join(' + '),
    [appliedScopes, scopes]
  );

  const parentNodePrefix = useMemo(
    () =>
      isLoadingTitle ? <Skeleton width={30} height={14} /> : displayTitle ? <span>{displayTitle}:</span> : undefined,
    [isLoadingTitle, displayTitle]
  );

  const inputText = scopesTitles || placeholderText;
  const lengthInGridUnits = measureText(inputText, theme.typography.fontSize).width / theme.spacing.gridSize + 2;
  const inputWidth = Math.min(Math.max(lengthInGridUnits, 18), 30); // min width for empty input, max width for long texts

  return (
    <Tooltip content={tooltipContent} interactive>
      <Input
        readOnly
        placeholder={placeholderText}
        disabled={disabled}
        loading={loading}
        value={scopesTitles}
        aria-label={placeholderText}
        data-testid="scopes-selector-input"
        className={styles.input}
        prefix={parentNodePrefix}
        suffix={<Icon name="angle-down" />}
        width={inputWidth}
        onClick={() => {
          if (!disabled) {
            onInputClick();
          }
        }}
      />
    </Tooltip>
  );
}

const getScopesPath = (appliedScopes: SelectedScope[], nodes: NodesMap) => {
  let nicePath: string[] | undefined;

  if (appliedScopes.length > 0 && appliedScopes[0].scopeNodeId) {
    let path = getPathOfNode(appliedScopes[0].scopeNodeId, nodes);
    // Get reed of empty root section and the actual scope node
    path = path.slice(1, -1);

    // We may not have all the nodes in path loaded
    nicePath = path.map((p) => nodes[p]?.spec.title).filter((p) => p);
  }

  return nicePath;
};

export interface ScopesTooltipProps {
  nodes: NodesMap;
  scopes: ScopesMap;
  appliedScopes: SelectedScope[];
}

function ScopesTooltip({ nodes, scopes, appliedScopes }: ScopesTooltipProps) {
  const nicePath = getScopesPath(appliedScopes, nodes);

  const scopeNames = appliedScopes.map((s) => {
    if (s.scopeNodeId) {
      return nodes[s.scopeNodeId]?.spec.title || s.scopeNodeId;
    } else {
      return scopes[s.scopeId]?.spec.title || s.scopeId;
    }
  });

  return <>{(nicePath && nicePath.length > 0 ? nicePath.join(' > ') + ' > ' : '') + scopeNames.join(', ')}</>;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    input: css({
      // it's readonly but should have normal input bg
      'input:not(disabled)': {
        background: theme.components.input.background,
      },
    }),
  };
};
