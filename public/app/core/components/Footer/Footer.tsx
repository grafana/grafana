import React from 'react';

import { LinkTarget } from '@grafana/data';
import { IconName } from '@grafana/ui';

export interface FooterLink {
  target: LinkTarget;
  text: string;
  id: string;
  icon?: IconName;
  url?: string;
}

export let getFooterLinks = (): FooterLink[] => [];

export interface Props {
  /** Link overrides to show specific links in the UI */
  customLinks?: FooterLink[] | null;
}

export const Footer = React.memo(() => <footer className="footer"></footer>);

Footer.displayName = 'Footer';
