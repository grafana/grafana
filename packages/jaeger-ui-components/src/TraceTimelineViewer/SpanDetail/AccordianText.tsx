// Copyright (c) 2019 Uber Technologies, Inc.
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
import { css } from 'emotion';
import cx from 'classnames';
import IoIosArrowDown from 'react-icons/lib/io/ios-arrow-down';
import IoIosArrowRight from 'react-icons/lib/io/ios-arrow-right';
import TextList from './TextList';
import { TNil } from '../../types';
import { getStyles as getAccordianKeyValuesStyles } from './AccordianKeyValues';
import { autoColor, createStyle, Theme, useTheme } from '../../Theme';
import { uAlignIcon } from '../../uberUtilityStyles';

const getStyles = createStyle((theme: Theme) => {
  return {
    header: css`
      cursor: pointer;
      overflow: hidden;
      padding: 0.25em 0.1em;
      text-overflow: ellipsis;
      white-space: nowrap;
      &:hover {
        background: ${autoColor(theme, '#e8e8e8')};
      }
    `,
  };
});

type AccordianTextProps = {
  className?: string | TNil;
  headerClassName?: string | TNil;
  data: string[];
  highContrast?: boolean;
  interactive?: boolean;
  isOpen: boolean;
  label: React.ReactNode | string;
  onToggle?: null | (() => void);
  TextComponent?: React.ElementType<{ data: string[] }>;
};

function DefaultTextComponent({ data }: { data: string[] }) {
  return <TextList data={data} />;
}

export default function AccordianText(props: AccordianTextProps) {
  const {
    className,
    data,
    headerClassName,
    interactive,
    isOpen,
    label,
    onToggle,
    TextComponent = DefaultTextComponent,
  } = props;
  const isEmpty = !Array.isArray(data) || !data.length;
  const accordianKeyValuesStyles = getAccordianKeyValuesStyles(useTheme());
  const iconCls = cx(uAlignIcon, { [accordianKeyValuesStyles.emptyIcon]: isEmpty });
  let arrow: React.ReactNode | null = null;
  let headerProps: {} | null = null;
  if (interactive) {
    arrow = isOpen ? <IoIosArrowDown className={iconCls} /> : <IoIosArrowRight className={iconCls} />;
    headerProps = {
      'aria-checked': isOpen,
      onClick: isEmpty ? null : onToggle,
      role: 'switch',
    };
  }
  const styles = getStyles(useTheme());
  return (
    <div className={className || ''}>
      <div className={cx(styles.header, headerClassName)} {...headerProps} data-test-id="AccordianText--header">
        {arrow}
        <strong>{label}</strong> ({data.length})
      </div>
      {isOpen && <TextComponent data={data} />}
    </div>
  );
}

AccordianText.defaultProps = {
  className: null,
  highContrast: false,
  interactive: true,
  onToggle: null,
};
