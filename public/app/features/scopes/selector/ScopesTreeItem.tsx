import { css, cx } from '@emotion/css';
import Highlighter from 'react-highlight-words';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, RadioButtonDot, useStyles2, Text } from '@grafana/ui';

import { useScopesServices } from '../ScopesContextProvider';
import { ScopesTree } from './ScopesTree';
import { isNodeExpandable, isNodeSelectable } from './scopesTreeUtils';
import { NodesMap, SelectedScope, TreeNode } from './types';

// Helper components for rendering different selectable content types
interface RadioButtonDotProps {
  scopeNodeId: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ScopeRadioButtonDot({ scopeNodeId, selected, onClick, children }: RadioButtonDotProps) {
  return (
    <RadioButtonDot
      id={scopeNodeId}
      name={scopeNodeId}
      checked={selected}
      label={children}
      data-testid={`scopes-tree-${scopeNodeId}-radio`}
      onClick={onClick}
    />
  );
}

interface LinkLikeButtonProps {
  scopeNodeId: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ScopeLinkLikeButton({ scopeNodeId, onClick, children }: LinkLikeButtonProps) {
  const styles = useStyles2(getStyles);
  return (
    <button className={styles.linkLikeItem} data-testid={`scopes-tree-${scopeNodeId}-link`} onClick={onClick}>
      {children}
    </button>
  );
}

interface CheckboxWithLabelProps {
  scopeNodeId: string;
  selected: boolean;
  showLabel: boolean;
  onChange: () => void;
  children?: React.ReactNode;
}

function ScopeCheckboxWithLabel({ scopeNodeId, selected, showLabel, onChange, children }: CheckboxWithLabelProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.checkboxWithLabel}>
      <Checkbox
        id={scopeNodeId}
        checked={selected}
        data-testid={`scopes-tree-${scopeNodeId}-checkbox`}
        label=""
        onChange={onChange}
      />
      {showLabel && (
        <label htmlFor={scopeNodeId} className={styles.checkboxLabel}>
          {children}
        </label>
      )}
    </div>
  );
}

interface TitleContentProps {
  shouldHighlight: boolean;
  titleText: string;
  searchWords: string[];
}

function TitleContent({ shouldHighlight, titleText, searchWords }: TitleContentProps) {
  if (shouldHighlight) {
    return <Highlighter textToHighlight={titleText} searchWords={searchWords} autoEscape />;
  }
  return <>{titleText}</>;
}

interface ExpandButtonProps {
  scopeNodeId: string;
  expanded: boolean;
  titleText: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ScopeExpandButton({ scopeNodeId, expanded, titleText, onClick, children }: ExpandButtonProps) {
  const styles = useStyles2(getStyles);
  return (
    <button
      className={styles.expand}
      data-testid={`scopes-tree-${scopeNodeId}-expand`}
      aria-label={
        expanded
          ? t('scopes.tree.collapse', 'Collapse {{title}}', { title: titleText })
          : t('scopes.tree.expand', 'Expand {{title}}', { title: titleText })
      }
      onClick={onClick}
    >
      <Icon name={!expanded ? 'angle-right' : 'angle-down'} />
      {children}
    </button>
  );
}

export interface ScopesTreeItemProps {
  anyChildExpanded: boolean;
  loadingNodeName: string | undefined;
  treeNode: TreeNode;
  scopeNodes: NodesMap;
  selected: boolean;
  selectedScopes: SelectedScope[];
  highlighted: boolean;

  filterNode: (scopeNodeId: string, query: string) => void;
  selectScope: (scopeNodeId: string) => void;
  deselectScope: (scopeNodeId: string) => void;
  toggleExpandedNode: (scopeNodeId: string) => void;
}

export function ScopesTreeItem({
  anyChildExpanded,
  loadingNodeName,
  treeNode,
  filterNode,
  scopeNodes,
  selected,
  selectedScopes,
  selectScope,
  deselectScope,
  highlighted,
  toggleExpandedNode,
}: ScopesTreeItemProps) {
  const styles = useStyles2(getStyles);
  // Import the closeAndApply function
  const services = useScopesServices();
  const { closeAndApply } = services?.scopesSelectorService || {};
  if (anyChildExpanded && !treeNode.expanded) {
    return null;
  }

  const scopeNode = scopeNodes[treeNode.scopeNodeId];
  if (!scopeNode) {
    // Should not happen as only way we show a tree is if we also load the nodes.
    return null;
  }

  const parentNode = scopeNode.spec.parentName ? scopeNodes[scopeNode.spec.parentName] : undefined;
  const disableMultiSelect = parentNode?.spec.disableMultiSelect ?? false;

  const isSelectable = isNodeSelectable(scopeNode);
  const isExpandable = isNodeExpandable(scopeNode);

  // Create search words for highlighting if there's a query
  // Only highlight if we have a query AND this node is not expanded (not a parent showing children)
  const titleText = scopeNode.spec.title;
  const shouldHighlight = Boolean(treeNode.query && !treeNode.expanded);
  const searchWords = shouldHighlight ? getSearchWordsFromQuery(treeNode.query) : [];

  return (
    <div
      key={treeNode.scopeNodeId}
      id={getTreeItemElementId(treeNode.scopeNodeId)}
      role="treeitem"
      // aria-selected refers to the highlighted item in the tree, not the selected checkbox/radio button
      aria-selected={highlighted}
      aria-expanded={isExpandable ? treeNode.expanded : undefined}
      className={anyChildExpanded ? styles.expandedContainer : undefined}
    >
      <div
        className={cx(
          styles.title,
          isSelectable && !treeNode.expanded && styles.titlePadding,
          highlighted && styles.highlighted
        )}
        data-testid={`scopes-tree-${treeNode.scopeNodeId}`}
      >
        {isSelectable && !treeNode.expanded && (
          <>
            {disableMultiSelect && isExpandable && (
              <ScopeRadioButtonDot
                scopeNodeId={treeNode.scopeNodeId}
                selected={selected}
                onClick={() => {
                  selected ? deselectScope(treeNode.scopeNodeId) : selectScope(treeNode.scopeNodeId);
                }}
              >
                {isExpandable ? (
                  // Let the expand button handle the text
                  ''
                ) : (
                  <TitleContent shouldHighlight={shouldHighlight} titleText={titleText} searchWords={searchWords} />
                )}
              </ScopeRadioButtonDot>
            )}
            {disableMultiSelect && !isExpandable && (
              <ScopeLinkLikeButton
                scopeNodeId={treeNode.scopeNodeId}
                onClick={() => {
                  selectScope(treeNode.scopeNodeId);
                  closeAndApply?.();
                }}
              >
                <TitleContent shouldHighlight={shouldHighlight} titleText={titleText} searchWords={searchWords} />
              </ScopeLinkLikeButton>
            )}
            {!disableMultiSelect && (
              <ScopeCheckboxWithLabel
                scopeNodeId={treeNode.scopeNodeId}
                selected={selected}
                showLabel={!isExpandable}
                onChange={() => {
                  selected ? deselectScope(treeNode.scopeNodeId) : selectScope(treeNode.scopeNodeId);
                }}
              >
                <TitleContent shouldHighlight={shouldHighlight} titleText={titleText} searchWords={searchWords} />
              </ScopeCheckboxWithLabel>
            )}
          </>
        )}

        {isExpandable && (
          <ScopeExpandButton
            scopeNodeId={treeNode.scopeNodeId}
            expanded={treeNode.expanded}
            titleText={titleText}
            onClick={() => {
              toggleExpandedNode(treeNode.scopeNodeId);
            }}
          >
            <TitleContent shouldHighlight={shouldHighlight} titleText={titleText} searchWords={searchWords} />
          </ScopeExpandButton>
        )}

        {scopeNode.spec.subTitle && (
          <Text truncate variant="body" color="secondary">
            {scopeNode.spec.subTitle}
          </Text>
        )}
      </div>

      <div className={styles.children}>
        {treeNode.expanded && (
          <ScopesTree
            tree={treeNode}
            loadingNodeName={loadingNodeName}
            filterNode={filterNode}
            scopeNodes={scopeNodes}
            selectedScopes={selectedScopes}
            selectScope={selectScope}
            deselectScope={deselectScope}
            toggleExpandedNode={toggleExpandedNode}
          />
        )}
      </div>
    </div>
  );
}

// Convert a query string with wildcards into search words for react-highlight-words
function getSearchWordsFromQuery(query: string): string[] {
  if (!query) {
    return [];
  }
  // Split query string on wildcard and filter out empty parts
  return query.split('*').filter((part) => part.length > 0);
}

export const getTreeItemElementId = (scopeNodeId?: string) => {
  return scopeNodeId ? `scopes-tree-item-${scopeNodeId}` : undefined;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    highlighted: css({
      background: theme.colors.action.focus,
      borderRadius: theme.shape.radius.default,
    }),
    expandedContainer: css({
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '100%',
    }),
    title: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(22),
      padding: theme.spacing(0.5, 0),

      '& > label :last-child': css({
        fontSize: theme.typography.pxToRem(14),
        lineHeight: theme.typography.pxToRem(22),
        fontWeight: theme.typography.fontWeightRegular,
      }),
    }),
    titlePadding: css({
      // Fix for checkboxes and radios outline overflow due to scrollbars
      paddingLeft: theme.spacing(0.5),
    }),
    checkboxWithLabel: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
    }),
    checkboxLabel: css({
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(22),
      fontWeight: theme.typography.fontWeightRegular,
      cursor: 'pointer',
      margin: 0,
    }),
    expand: css({
      alignItems: 'center',
      background: 'none',
      border: 0,
      display: 'flex',
      gap: theme.spacing(1),
      margin: 0,
      padding: 0,
    }),
    linkLikeItem: css({
      alignItems: 'center',
      background: 'none',
      border: 0,
      display: 'flex',
      gap: theme.spacing(1),
      margin: 0,
      padding: 0,
      textDecoration: 'none',

      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    children: css({
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'hidden',
      maxHeight: '100%',
      paddingLeft: theme.spacing(4),
    }),
  };
};
