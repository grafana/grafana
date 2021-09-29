import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useDisplayMode } from '../state/hooks';
import { CatalogPlugin, PluginListDisplayMode } from '../types';
import { PluginListItemRow } from './PluginListItemRow';
import { PluginListItemCard } from './PluginListItemCard';

export const LOGO_SIZE = '48px';

type Props = {
  plugin: CatalogPlugin;
  pathName: string;
};

export function PluginListItem({ plugin, pathName }: Props) {
  const { displayMode } = useDisplayMode();
  const isList = displayMode === PluginListDisplayMode.List;

  if (isList) {
    return <PluginListItemRow plugin={plugin} pathName={pathName} />;
  }

  return <PluginListItemCard plugin={plugin} pathName={pathName} />;
}

// Styles shared between the different type of list items
export const getStyles = (theme: GrafanaTheme2, displayMode: PluginListDisplayMode) => {
  const isRow = displayMode === PluginListDisplayMode.List;
  const isCard = displayMode === PluginListDisplayMode.Grid;

  return {
    cardContainer: css`
      margin-bottom: 0;
      padding: ${theme.spacing()};
    `,
    headerWrap: css`
      display: grid;
      grid-template-columns: ${LOGO_SIZE} 1fr ${theme.spacing(3)};
      grid-gap: ${theme.spacing(2)};
      width: 100%;
      ${isCard &&
      css`
        align-items: center;
      `}
    `,
    name: css`
      color: ${theme.colors.text.primary};
      flex-grow: 1;
      font-size: ${theme.typography.h4.fontSize};
      margin-bottom: 0;
    `,
    image: css`
      object-fit: contain;
      max-width: 100%;
    `,
    icon: css`
      align-self: flex-start;
      color: ${theme.colors.text.secondary};
    `,
    orgName: css`
      color: ${theme.colors.text.secondary};
      ${isRow &&
      css`
        margin: ${theme.spacing(0, 0, 0.5, 0)};
      `}
      ${isCard &&
      css`
        margin-bottom: 0;
      `};
    `,
    hasUpdate: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      margin-bottom: 0;
    `,
  };
};
