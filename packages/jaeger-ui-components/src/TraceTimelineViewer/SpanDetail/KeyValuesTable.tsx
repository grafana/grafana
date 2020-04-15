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

import * as React from 'react';
import jsonMarkup from 'json-markup';
import { css } from 'emotion';
import cx from 'classnames';

import CopyIcon from '../../common/CopyIcon';

import { TNil } from '../../types';
import { KeyValuePair, Link } from '../../types/trace';
import { UIDropdown, UIIcon, UIMenu, UIMenuItem } from '../../uiElementsContext';
import { autoColor, createStyle, Theme, useTheme } from '../../Theme';
import { ubInlineBlock, uWidth100 } from '../../uberUtilityStyles';

export const getStyles = createStyle((theme: Theme) => {
  const copyIcon = css`
    label: copyIcon;
  `;
  return {
    KeyValueTable: css`
      label: KeyValueTable;
      background: ${autoColor(theme, '#fff')};
      border: 1px solid ${autoColor(theme, '#ddd')};
      margin-bottom: 0.7em;
      max-height: 450px;
      overflow: auto;
    `,
    body: css`
      label: body;
      vertical-align: baseline;
    `,
    row: css`
      label: row;
      & > td {
        padding: 0.25rem 0.5rem;
        padding: 0.25rem 0.5rem;
        vertical-align: top;
      }
      &:nth-child(2n) > td {
        background: ${autoColor(theme, '#f5f5f5')};
      }
      &:not(:hover) .${copyIcon} {
        display: none;
      }
    `,
    keyColumn: css`
      label: keyColumn;
      color: ${autoColor(theme, '#888')};
      white-space: pre;
      width: 125px;
    `,
    copyColumn: css`
      label: copyColumn;
      text-align: right;
    `,
    linkIcon: css`
      label: linkIcon;
      vertical-align: middle;
      font-weight: bold;
    `,
    copyIcon,
  };
});

const jsonObjectOrArrayStartRegex = /^(\[|\{)/;

function parseIfComplexJson(value: any) {
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

export const LinkValue = (props: { href: string; title?: string; children: React.ReactNode }) => {
  const styles = getStyles(useTheme());
  return (
    <a href={props.href} title={props.title} target="_blank" rel="noopener noreferrer">
      {props.children} <UIIcon className={styles.linkIcon} type="export" />
    </a>
  );
};

LinkValue.defaultProps = {
  title: '',
};

const linkValueList = (links: Link[]) => (
  <UIMenu>
    {links.map(({ text, url }, index) => (
      // `index` is necessary in the key because url can repeat
      <UIMenuItem key={`${url}-${index}`}>
        <LinkValue href={url}>{text}</LinkValue>
      </UIMenuItem>
    ))}
  </UIMenu>
);

type KeyValuesTableProps = {
  data: KeyValuePair[];
  linksGetter: ((pairs: KeyValuePair[], index: number) => Link[]) | TNil;
};

export default function KeyValuesTable(props: KeyValuesTableProps) {
  const { data, linksGetter } = props;
  const styles = getStyles(useTheme());
  return (
    <div className={cx(styles.KeyValueTable)} data-test-id="KeyValueTable">
      <table className={uWidth100}>
        <tbody className={styles.body}>
          {data.map((row, i) => {
            const markup = {
              __html: jsonMarkup(parseIfComplexJson(row.value)),
            };
            const jsonTable = <div className={ubInlineBlock} dangerouslySetInnerHTML={markup} />;
            const links = linksGetter ? linksGetter(data, i) : null;
            let valueMarkup;
            if (links && links.length === 1) {
              valueMarkup = (
                <div>
                  <LinkValue href={links[0].url} title={links[0].text}>
                    {jsonTable}
                  </LinkValue>
                </div>
              );
            } else if (links && links.length > 1) {
              valueMarkup = (
                <div>
                  <UIDropdown overlay={linkValueList(links)} placement="bottomRight" trigger={['click']}>
                    <a>
                      {jsonTable} <UIIcon className={styles.linkIcon} type="profile" />
                    </a>
                  </UIDropdown>
                </div>
              );
            } else {
              valueMarkup = jsonTable;
            }
            return (
              // `i` is necessary in the key because row.key can repeat
              <tr className={styles.row} key={`${row.key}-${i}`}>
                <td className={styles.keyColumn} data-test-id="KeyValueTable--keyColumn">
                  {row.key}
                </td>
                <td>{valueMarkup}</td>
                <td className={styles.copyColumn}>
                  <CopyIcon
                    className={styles.copyIcon}
                    copyText={JSON.stringify(row, null, 2)}
                    tooltipTitle="Copy JSON"
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
