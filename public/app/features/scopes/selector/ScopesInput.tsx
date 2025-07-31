import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Input, Tooltip, useStyles2 } from '@grafana/ui';

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
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const parentNodeId = appliedScopes[0]?.parentNodeId;
  const parentNode = useScopeNode(parentNodeId);
  const parentNodeTitle = parentNode?.spec.title;

  useEffect(() => {
    setTooltipVisible(false);
  }, [appliedScopes]);

  const tooltipContent =
    appliedScopes.length > 0 ? <ScopesTooltip nodes={nodes} scopes={scopes} appliedScopes={appliedScopes} /> : <></>;

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

  const input = useMemo(
    () => (
      <Input
        readOnly
        placeholder={t('scopes.selector.input.placeholder', 'Select scopes...')}
        disabled={disabled}
        loading={loading}
        value={scopesTitles}
        aria-label={t('scopes.selector.input.placeholder', 'Select scopes...')}
        data-testid="scopes-selector-input"
        prefix={parentNodeTitle ? <span>{parentNodeTitle}:</span> : undefined}
        suffix={
          appliedScopes.length > 0 && !disabled ? (
            <IconButton
              aria-label={t('scopes.selector.input.removeAll', 'Remove all scopes')}
              name="times"
              data-testid="scopes-selector-input-clear"
              onClick={() => onRemoveAllClick()}
            />
          ) : undefined
        }
        onMouseOver={() => setTooltipVisible(true)}
        onMouseOut={() => setTooltipVisible(false)}
        onClick={() => {
          if (!disabled) {
            onInputClick();
          }
        }}
      />
    ),
    [disabled, loading, onInputClick, onRemoveAllClick, appliedScopes, scopesTitles, parentNodeTitle]
  );

  return (
    <Tooltip content={tooltipContent} show={appliedScopes.length === 0 ? false : tooltipVisible}>
      {input}
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
  const styles = useStyles2(getStyles);

  const nicePath = getScopesPath(appliedScopes, nodes);

  const scopeNames = appliedScopes.map((s) => {
    if (s.scopeNodeId) {
      return nodes[s.scopeNodeId]?.spec.title || s.scopeNodeId;
    } else {
      return scopes[s.scopeId]?.spec.title || s.scopeId;
    }
  });

  return (
    <>
      <p className={styles.scopePath}>
        {(nicePath && nicePath.length > 0 ? nicePath.join(' > ') + ' > ' : '') + scopeNames.join(', ')}
      </p>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    scopePath: css({
      color: theme.colors.text.primary,
      fontSize: theme.typography.pxToRem(12),
      margin: theme.spacing(0, 0),
    }),
  };
};
