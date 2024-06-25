import { css } from '@emotion/css';
import { groupBy } from 'lodash';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Input, Tooltip } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/';
import { t } from 'app/core/internationalization';

import { NodesMap, SelectedScope } from './types';

export interface ScopesInputProps {
  nodes: NodesMap;
  scopes: SelectedScope[];
  isDisabled: boolean;
  isLoading: boolean;
  onInputClick: () => void;
  onRemoveAllClick: () => void;
}

export function ScopesInput({
  nodes,
  scopes,
  isDisabled,
  isLoading,
  onInputClick,
  onRemoveAllClick,
}: ScopesInputProps) {
  const styles = useStyles2(getStyles);

  const scopesPaths = useMemo(() => {
    const pathsTitles = scopes.map(({ scope, path }) => {
      let currentLevel = nodes;

      let titles: string[];

      if (path.length > 0) {
        titles = path
          .map((nodeName) => {
            const cl = currentLevel[nodeName];
            if (!cl) {
              return null;
            }

            const { title, nodes } = cl;

            currentLevel = nodes;

            return title;
          })
          .filter((title) => title !== null) as string[];

        if (titles[0] === '') {
          titles.splice(0, 1);
        }
      } else {
        titles = [scope.spec.title];
      }

      const scopeName = titles.pop();

      return [titles.join(' > '), scopeName];
    });

    const groupedByPath = groupBy(pathsTitles, ([path]) => path);

    return Object.entries(groupedByPath)
      .map(([path, pathScopes]) => {
        const scopesTitles = pathScopes.map(([, scopeTitle]) => scopeTitle).join(', ');

        return (path ? [path, scopesTitles] : [scopesTitles]).join(' > ');
      })
      .map((path) => (
        <p key={path} className={styles.scopePath}>
          {path}
        </p>
      ));
  }, [nodes, scopes, styles]);

  const scopesTitles = useMemo(() => scopes.map(({ scope }) => scope.spec.title).join(', '), [scopes]);

  const input = (
    <Input
      readOnly
      placeholder={t('scopes.filters.input.placeholder', 'Select scopes...')}
      loading={isLoading}
      value={scopesTitles}
      aria-label={t('scopes.filters.input.placeholder', 'Select scopes...')}
      data-testid="scopes-filters-input"
      suffix={
        scopes.length > 0 && !isDisabled ? (
          <IconButton
            aria-label={t('scopes.filters.input.removeAll', 'Remove all scopes')}
            name="times"
            onClick={() => onRemoveAllClick()}
          />
        ) : undefined
      }
      onClick={() => {
        if (!isDisabled) {
          onInputClick();
        }
      }}
    />
  );

  if (scopes.length === 0) {
    return input;
  }

  return (
    <Tooltip content={<>{scopesPaths}</>} interactive={true}>
      {input}
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    scopePath: css({
      color: theme.colors.text.primary,
      fontSize: theme.typography.pxToRem(14),
      margin: theme.spacing(1, 0),
    }),
  };
};
