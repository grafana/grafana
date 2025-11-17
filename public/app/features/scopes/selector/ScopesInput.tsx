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
  const parentNodeIdFromUrl = appliedScopes[0]?.parentNodeId;
  const styles = useStyles2(getStyles);
  const { node: scopeNode, isLoading: scopeNodeLoading } = useScopeNode(scopeNodeId);

  // Get parent from scope node if available, otherwise use parentNodeId from URL (for backward compatibility)
  const parentNodeId = scopeNode?.spec.parentName ?? parentNodeIdFromUrl;
  const { node: parentNode, isLoading: parentNodeLoading } = useScopeNode(parentNodeId);

  // Prioritize scope node subtitle over parent node title
  const displayTitle = scopeNode?.spec.subTitle ?? parentNode?.spec.title;
  const isLoadingTitle = scopeNodeLoading || parentNodeLoading;
  const placeholderText = t('scopes.selector.input.placeholder', 'No scopes');

  const tooltipContent = (
    <ScopesTooltip nodes={nodes} scopes={scopes} appliedScopes={appliedScopes} onRemoveAllClick={onRemoveAllClick} />
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
      <div className={styles.wrapper}>
        {loading && (
          <div className={styles.prefix}>
            <Spinner />
          </div>
        )}
        <button
          className={styles.fakeInput}
          onClick={onClick}
          aria-label={placeholderText}
          data-testid="scopes-selector-input"
        >
          <span className={styles.text}>
            {!scopesTitles && !loading && <Text color="secondary">{placeholderText}</Text>}
            {scopesTitles && <span>{scopesTitles}</span>}
            {!isLoadingTitle && displayTitle && <span className={styles.parentNode}>{displayTitle}</span>}
          </span>
        </button>
        <div className={styles.suffix}>
          <Icon name="angle-down" />
        </div>
      </div>
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
  onRemoveAllClick?: () => void;
}

function ScopesTooltip({ nodes, scopes, appliedScopes, onRemoveAllClick }: ScopesTooltipProps) {
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
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const baseStyles = getInputStyles({ theme });

  return {
    wrapper: cx(
      baseStyles.wrapper,
      css({
        width: 'auto',
        minWidth: 60,
        maxWidth: 250,
        position: 'relative',
      })
    ),
    prefix: baseStyles.prefix,
    suffix: css([
      baseStyles.suffix,
      {
        display: 'flex',
        gap: theme.spacing(0.5),
      },
    ]),
    fakeInput: css([
      baseStyles.input,
      {
        display: 'flex',
        alignItems: 'center',
        textAlign: 'left',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        paddingRight: 28,

        '&:not(disabled)': {
          cursor: 'pointer',
          background: theme.components.input.background,
        },

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
      marginLeft: theme.spacing(1),
      paddingLeft: theme.spacing(1),
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.secondary,
    }),
  };
};
