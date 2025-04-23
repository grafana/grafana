import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, FilterPill, Stack, Text, useStyles2 } from '@grafana/ui';

import { Trans } from '../../core/internationalization';
import { getModKey } from '../../core/utils/browser';
import { ToggleNode, TreeScope } from '../scopes/selector/types';

type Props = {
  treeScopes: TreeScope[];
  isDirty: boolean;
  apply: () => void;
  toggleNode: (node: ToggleNode) => void;
};

/**
 * Shows scopes that are already selected and applied or the ones user just selected in the palette, with an apply
 * button if the selection is dirty.
 */
export function ScopesRow({ treeScopes, isDirty, apply, toggleNode }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <>
      <Stack alignItems={'center'}>
        <span className={styles.scopesText}>
          <Trans i18nKey={'command-palette.scopes.selected-scopes-label'}>Scopes: </Trans>
        </span>
        {treeScopes?.map((scope) => {
          return (
            <FilterPill
              key={scope.scopeName}
              selected={true}
              icon={'times'}
              label={scope.title}
              onClick={() => {
                toggleNode(scope);
              }}
            />
          );
        })}
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
