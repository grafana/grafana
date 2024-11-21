import { css } from '@emotion/css';
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
    const pathsScopesMap = scopes.reduce<Record<string, string>>((acc, { scope, path }) => {
      let currentLevel = nodes;

      const titles = path.reduce<string[]>((acc, nodeName) => {
        const cl = currentLevel?.[nodeName];

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

      const scopeName = titles.length > 0 ? titles.pop()! : scope.spec.title;
      const titlesString = titles.length > 0 ? titles.join(' > ') : '';

      acc[titlesString] = acc[titlesString] ? `${acc[titlesString]}, ${scopeName}` : scopeName;

      return acc;
    }, {});

    return (
      <>
        {Object.entries(pathsScopesMap).map(([path, scopesTitles]) => (
          <p key={path} className={styles.scopePath}>
            {path ? `${path} > ${scopesTitles}` : scopesTitles}
          </p>
        ))}
      </>
    );
  }, [nodes, scopes, styles]);

  const scopesTitles = useMemo(() => scopes.map(({ scope }) => scope.spec.title).join(', '), [scopes]);

  const input = useMemo(
    () => (
      <Input
        readOnly
        placeholder={t('scopes.selector.input.placeholder', 'Select scopes...')}
        disabled={isDisabled}
        loading={isLoading}
        value={scopesTitles}
        aria-label={t('scopes.selector.input.placeholder', 'Select scopes...')}
        data-testid="scopes-selector-input"
        suffix={
          scopes.length > 0 && !isDisabled ? (
            <IconButton
              aria-label={t('scopes.selector.input.removeAll', 'Remove all scopes')}
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
      fontSize: theme.typography.pxToRem(12),
      margin: theme.spacing(0, 0),
    }),
  };
};
