import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, FilterPill, Stack, Text, useStyles2 } from '@grafana/ui';

import { getModKey } from '../../core/utils/browser';
import { NodesMap, ScopesMap, SelectedScope } from '../scopes/selector/types';

type Props = {
  selectedScopes: SelectedScope[];
  isDirty: boolean;
  apply: () => void;
  deselectScope: (id: string) => void;
  scopes: ScopesMap;
  nodes: NodesMap;
};

/**
 * Shows scopes that are already selected and applied or the ones user just selected in the palette, with an apply
 * button if the selection is dirty.
 */
export function ScopesRow({ selectedScopes, isDirty, apply, deselectScope, scopes, nodes }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <>
      <Stack alignItems={'center'}>
        <span className={styles.scopesText}>
          <Trans i18nKey={'command-palette.scopes.selected-scopes-label'}>Scopes: </Trans>
        </span>
        <Stack wrap={'wrap'}>
          {selectedScopes?.map((scope) => {
            // We need to load scope data when an item is selected, so there may be a delay until we have it. We fallback
            // to node.title if we have it and if not, show just a scopeId. node.title and scope.title should probably be
            // the same, but it's not guaranteed
            const label =
              scopes[scope.scopeId]?.spec.title ||
              (scope.scopeNodeId && nodes[scope.scopeNodeId]?.spec.title) ||
              scope.scopeId;

            return (
              <FilterPill
                key={scope.scopeId}
                selected={true}
                icon={'times'}
                label={label}
                onClick={() => {
                  deselectScope(scope.scopeNodeId || scope.scopeId);
                }}
              />
            );
          })}
        </Stack>
      </Stack>
      {isDirty && (
        <Button
          onClick={() => {
            apply();
          }}
        >
          <Trans i18nKey={'command-palette.scopes.apply-selected-scopes'}>Apply</Trans>&nbsp;
          <Text variant="bodySmall">{`${getModKey()}+↵`}</Text>
        </Button>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    scopesText: css({
      label: 'scopesText',
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      color: theme.colors.text.secondary,
    }),
    selectedScope: css({
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0, 0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      color: theme.colors.text.secondary,
      display: 'inline-flex',
      alignItems: 'center',
      position: 'relative',
      border: `1px solid ${theme.colors.background.secondary}`,
      whiteSpace: 'nowrap',
      marginRight: theme.spacing(0.5),
    }),
  };
};
