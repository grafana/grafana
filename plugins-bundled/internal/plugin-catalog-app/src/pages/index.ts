import React from 'react';
import { AppRootProps } from '@grafana/data';
import { Discover } from './Discover';
import { Browse } from './Browse';
import { PluginDetails } from './PluginDetails';
import { OrgDetails } from './OrgDetails';
import { Library } from './Library';

export type PageDefinition = {
  component: React.FC<AppRootProps>;
  icon: string;
  id: string;
  text: string;
};

export const pages: PageDefinition[] = [
  {
    component: Discover,
    icon: 'file-alt',
    id: 'discover',
    text: 'Discover',
  },
  {
    component: Browse,
    icon: 'file-alt',
    id: 'browse',
    text: 'Browse',
  },
  {
    component: Library,
    icon: 'file-alt',
    id: 'library',
    text: 'Library',
  },
  {
    component: PluginDetails,
    icon: 'file-alt',
    id: 'plugin',
    text: 'Plugin',
  },
  {
    component: OrgDetails,
    icon: 'file-alt',
    id: 'org',
    text: 'Organization',
  },
];
