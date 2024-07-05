import { css } from '@emotion/css';
import { groupBy } from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Input, Tooltip, useStyles2 } from '@grafana/ui';
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

  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  useEffect(() => {
    setIsTooltipVisible(false);
  }, [scopes]);

  const scopesPaths = useMemo(() => {
    const pathsTitles = scopes.map(({ scope, path }) => {
      let currentLevel = nodes;

      let titles: string[];

      if (path.length > 0) {
        titles = path.reduce<string[]>((acc, nodeName) => {
          const cl = currentLevel[nodeName];

          if (!cl) {
            return acc;
          }

          const { title, nodes } = cl;

          currentLevel = nodes;

          acc.push(title);

          return acc;
        }, []);

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

    const scopesPaths = Object.entries(groupedByPath)
      .map(([path, pathScopes]) => {
        const scopesTitles = pathScopes.map(([, scopeTitle]) => scopeTitle).join(', ');

        return (path ? [path, scopesTitles] : [scopesTitles]).join(' > ');
      })
      .map((path) => (
        <p key={path} className={styles.scopePath}>
          {path}
        </p>
      ));

    return <>{scopesPaths}</>;
  }, [nodes, scopes, styles]);

  const scopesTitles = useMemo(() => scopes.map(({ scope }) => scope.spec.title).join(', '), [scopes]);

  const input = useMemo(
    () => (
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
        onMouseOver={() => setIsTooltipVisible(true)}
        onMouseOut={() => setIsTooltipVisible(false)}
        onClick={() => {
          if (!isDisabled) {
            onInputClick();
          }
        }}
      />
    ),
    [isDisabled, isLoading, onInputClick, onRemoveAllClick, scopes, scopesTitles]
  );

  return (
    <Tooltip content={scopesPaths} show={scopes.length === 0 ? false : isTooltipVisible}>
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
