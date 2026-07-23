// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { css } from '@emotion/css';
import cx from 'clsx';
import DOMPurify from 'dompurify';
import { type PropsWithChildren, type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import { type GrafanaTheme2, type PluginExtensionLink, type TraceKeyValuePair } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, Menu, useStyles2 } from '@grafana/ui';

import { autoColor } from '../../Theme';
import CopyIcon from '../../common/CopyIcon';
import type TNil from '../../types/TNil';

import jsonMarkup from './jsonMarkup';

const getStyles = (theme: GrafanaTheme2) => {
  const keyColor = theme.colors.text.secondary;

  return {
    KeyValueTable: css({
      label: 'KeyValueTable',
      background: autoColor(theme, '#fff'),
      maxHeight: '450px',
      overflow: 'auto',
    }),
    table: css({
      width: '100%',
    }),
    body: css({
      label: 'body',
    }),
    row: css({
      label: 'row',
      '& > td': {
        padding: '0 0.5rem',
        height: '30px',
        verticalAlign: 'middle',
      },
      '&:nth-child(2n) > td': {
        background: autoColor(theme, '#f5f5f5'),
      },
      '& > td:last-child button': {
        visibility: 'hidden',
      },
      '&:hover > td:last-child button': {
        visibility: 'visible',
      },
      'a span': {
        color: `${theme.colors.text.link} !important`,
      },
      'a:hover span': {
        textDecoration: 'underline',
      },
    }),
    keyColumn: css({
      label: 'keyColumn',
      color: keyColor,
      whiteSpace: 'pre',
      width: '125px',
    }),
    copyIcon: css({
      label: 'copyIcon',
      color: keyColor,
    }),
    copyColumn: css({
      label: 'copyColumn',
      textAlign: 'right',
      verticalAlign: 'middle',
      whiteSpace: 'nowrap',
    }),
    linkValue: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    linkIcon: css({
      flexShrink: 0,
    }),
    multiLinkValue: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
    }),
    multiLinkContent: css({
      color: theme.colors.text.link,
      // Match single-link styling so json-markup spans use the link color
      span: {
        color: `${theme.colors.text.link} !important`,
      },
    }),
    multiLinkTrigger: css({
      display: 'inline-flex',
      alignItems: 'center',
      padding: 0,
      margin: 0,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: theme.colors.text.link,
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    multiLinkChevron: css({
      flexShrink: 0,
    }),
    jsonTable: css({
      display: 'inline-block',
    }),
  };
};

const jsonObjectOrArrayStartRegex = /^(\[|\{)/;

function parseIfComplexJson(value: unknown) {
  // if the value is a string representing actual json object or array, then use json-markup
  if (typeof value === 'string' && jsonObjectOrArrayStartRegex.test(value)) {
    // otherwise just return as is
    try {
      return JSON.parse(value);
      // eslint-disable-next-line no-empty
    } catch (_) {}
  }
  return value;
}

export type KeyValuesTableLink = Partial<
  Pick<PluginExtensionLink, 'path' | 'title' | 'description' | 'onClick' | 'icon'>
>;

interface LinkValueProps {
  link: KeyValuesTableLink;
}

export const LinkValue = ({ link, children }: PropsWithChildren<LinkValueProps>) => {
  const { path, title = '', onClick, icon = 'external-link-alt' } = link;
  const styles = useStyles2(getStyles);

  return (
    <a
      href={path}
      title={title}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.linkValue}
    >
      <Icon name={icon} className={styles.linkIcon} />
      {children}
    </a>
  );
};

interface LinkValuesMenuProps {
  links: KeyValuesTableLink[];
  children: ReactNode;
}

export const LinkValuesMenu = ({ links, children }: LinkValuesMenuProps) => {
  const styles = useStyles2(getStyles);
  const openValueInLabel = t('explore.key-values-table.open-value-in', 'Open value in');
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuOffset, setMenuOffset] = useState<[number, number]>([8, 0]);

  // Align the menu to the start of the attribute value, not the chevron button
  useLayoutEffect(() => {
    const container = containerRef.current;
    const button = container?.querySelector('button');
    if (!container || !button) {
      return;
    }
    setMenuOffset([8, container.getBoundingClientRect().left - button.getBoundingClientRect().left]);
  }, [links, children]);

  return (
    <div className={styles.multiLinkValue} ref={containerRef}>
      <span className={styles.multiLinkContent}>{children}</span>
      <Dropdown
        placement="bottom-start"
        offset={menuOffset}
        overlay={
          <Menu>
            <Menu.Group label={openValueInLabel.toLocaleUpperCase()}>
              {links.map((link, index) => (
                <div key={index} title={link.title}>
                  <Menu.Item
                    label={link.description || link.title || t('explore.key-values-table.link-fallback-label', 'Link')}
                    icon={link.icon}
                    url={link.path}
                    target="_blank"
                    onClick={link.onClick}
                  />
                </div>
              ))}
            </Menu.Group>
          </Menu>
        }
      >
        <button type="button" className={styles.multiLinkTrigger} aria-label={openValueInLabel} title={openValueInLabel}>
          <Icon name="angle-down" size="sm" className={styles.multiLinkChevron} />
        </button>
      </Dropdown>
    </div>
  );
};

export type KeyValuesTableProps = {
  data: TraceKeyValuePair[];
  linksGetter?: ((pairs: TraceKeyValuePair[], index: number) => KeyValuesTableLink[]) | TNil;
  onlyValues?: boolean;
};

export default function KeyValuesTable(props: KeyValuesTableProps) {
  const { data, linksGetter, onlyValues } = props;
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.KeyValueTable)} data-testid="KeyValueTable">
      <table className={styles.table}>
        <tbody className={styles.body}>
          {data.map((row, i) => {
            let html = '';
            if (row.type === 'code') {
              html = `<pre style="border: none; background: none">${row.value}</pre>`;
            } else if (row.type === 'text') {
              html = `<span style="white-space: pre-wrap;">${row.value}</span>`;
            } else {
              html = jsonMarkup(parseIfComplexJson(row.value));
            }

            const jsonTable = (
              <div className={styles.jsonTable} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
            );
            const links = linksGetter?.(data, i) ?? [];
            const valueMarkup =
              links.length > 1 ? (
                <LinkValuesMenu links={links}>{jsonTable}</LinkValuesMenu>
              ) : links.length === 1 ? (
                <LinkValue link={links[0]}>{jsonTable}</LinkValue>
              ) : (
                jsonTable
              );

            return (
              // `i` is necessary in the key because row.key can repeat
              <tr className={styles.row} key={`${row.key}-${i}`}>
                {!onlyValues && (
                  <td className={styles.keyColumn} data-testid="KeyValueTable--keyColumn">
                    {row.key}
                  </td>
                )}
                <td>{valueMarkup}</td>
                <td className={styles.copyColumn}>
                  <CopyIcon
                    className={styles.copyIcon}
                    copyText={row.type === 'code' || row.type === 'text' ? row.value : JSON.stringify(row, null, 2)}
                    tooltipTitle="Copy"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
