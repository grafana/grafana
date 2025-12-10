import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getInputStyles, Icon, LinkButton, Spinner, Tooltip, useStyles2, Text, Stack } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

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
  const styles = useStyles2(getStyles);
  const parentNodeIdFromRecentScopes = appliedScopes[0]?.parentNodeId; // This is only set from recent scopes TODO: remove after recent scopes refactor
  const { node: scopeNode, isLoading: scopeNodeLoading } = useScopeNode(scopeNodeId);

  // Get parent from scope node if available, otherwise fallback to parent
  const parentNodeId = scopeNode?.spec.parentName ?? parentNodeIdFromRecentScopes;
  const { node: parentNode, isLoading: parentNodeLoading } = useScopeNode(parentNodeId);

  // Prioritize scope node subtitle over parent node title
  const displayTitle = scopeNode?.spec.subTitle ?? parentNode?.spec.title;
  const isLoadingTitle = scopeNodeLoading || parentNodeLoading;
  const placeholderText = t('scopes.selector.input.placeholder', 'No scopes');

  const tooltipContent = (
    <ScopesTooltip
      nodes={nodes}
      scopes={scopes}
      appliedScopes={appliedScopes}
      onRemoveAllClick={onRemoveAllClick}
      disabled={disabled}
    />
  );

  const scopesTitles = appliedScopes
    .map(
      (s) =>
        // If we are still loading the scope data just show the id
        scopes[s.scopeId]?.spec.title || s.scopeId
    )
    .join(' + ');

  const onClick = () => {
    if (!disabled) {
      onInputClick();
    }
  };

  return (
    <Tooltip content={tooltipContent} interactive>
      <button
        type="button"
        className={styles.fakeInput}
        disabled={disabled}
        onClick={onClick}
        aria-label={placeholderText}
        data-testid="scopes-selector-input"
        data-value={scopesTitles}
      >
        {loading && (
          <div className={styles.prefix}>
            <Spinner />
          </div>
        )}
        <span className={styles.text}>
          {!scopesTitles && !loading && <Text color="secondary">{placeholderText}</Text>}
          {!isLoadingTitle && displayTitle && <span className={styles.parentNode}>{displayTitle}</span>}
          {scopesTitles && <span>{scopesTitles}</span>}
        </span>

        <div className={styles.suffix}>
          <Icon name="angle-down" />
        </div>
      </button>
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
  disabled?: boolean;
  onRemoveAllClick?: () => void;
}

function ScopesTooltip({ nodes, scopes, appliedScopes, onRemoveAllClick, disabled }: ScopesTooltipProps) {
  if (appliedScopes.length === 0) {
    return t('scopes.selector.input.tooltip', 'Select scope');
  }

  const nicePath = getScopesPath(appliedScopes, nodes);
  const scopeNames = appliedScopes.map((s) => {
    if (s.scopeNodeId) {
      return nodes[s.scopeNodeId]?.spec.title || s.scopeNodeId;
    } else {
      return scopes[s.scopeId]?.spec.title || s.scopeId;
    }
  });

  const parentPaths = nicePath && nicePath.length > 0 ? nicePath.join(' > ') + ' > ' : '';

  return (
    <Stack direction="column" gap={1} justifyContent="center" alignItems={'center'}>
      <span>{parentPaths + scopeNames.join(', ')}</span>
      {!disabled && (
        <LinkButton
          onClick={onRemoveAllClick}
          aria-label={t('scopes.selector.input.removeAll', 'Remove all scopes')}
          name="times"
          data-testid="scopes-selector-input-clear"
          size="sm"
          fill="text"
          icon="times"
        >
          <Trans i18nKey="scopes.selector.input.remove-all">Remove all</Trans>
        </LinkButton>
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const baseStyles = getInputStyles({ theme });

  return {
    prefix: baseStyles.prefix,
    suffix: baseStyles.suffix,
    fakeInput: css([
      baseStyles.input,
      {
        width: 'auto',
        minWidth: 60,
        height: theme.spacing(theme.components.height.md),
        maxWidth: '40%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        textAlign: 'left',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        paddingRight: 28,
        flexGrow: 0,

        '&:disabled': cx(
          baseStyles.inputDisabled,
          css({
            cursor: 'not-allowed',
          })
        ),

        // We want the focus styles to appear only when tabbing through, not when clicking the button
        // (and when focus is restored after command palette closes)
        '&:focus': {
          outline: 'unset',
          boxShadow: 'unset',
        },

        '&:focus-visible': getFocusStyles(theme),
      },
    ]),
    text: css({
      textOverflow: 'ellipsis',
      overflow: 'hidden',
    }),
    parentNode: css({
      marginRight: theme.spacing(1),
      paddingRight: theme.spacing(1),
      borderRight: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.secondary,
    }),
  };
};
