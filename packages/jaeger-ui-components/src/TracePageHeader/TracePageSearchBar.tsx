// Copyright (c) 2018 Uber Technologies, Inc.
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
import cx from 'classnames';
import * as React from 'react';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import UiFindInput from '../common/UiFindInput';
import { ubFlexAuto, ubJustifyEnd } from '../uberUtilityStyles';

import * as markers from './TracePageSearchBar.markers';
// eslint-disable-next-line no-duplicate-imports

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    TracePageSearchBar: css`
      label: TracePageSearchBar;
      float: right;
      position: sticky;
      top: 8px;
      right: 0;
      z-index: ${theme.zIndex.navbarFixed};
      background: ${theme.colors.background.primary};
      margin-top: 8px;
      margin-bottom: -48px;
      padding: 8px;
      margin-right: 2px;
      border-radius: 4px;
      box-shadow: ${theme.shadows.z2};
    `,
    TracePageSearchBarBar: css`
      label: TracePageSearchBarBar;
      max-width: 20rem;
      transition: max-width 0.5s;
      &:focus-within {
        max-width: 100%;
      }
    `,
    TracePageSearchBarSuffix: css`
      label: TracePageSearchBarSuffix;
      opacity: 0.6;
    `,
    TracePageSearchBarBtn: css`
      label: TracePageSearchBarBtn;
      transition: 0.2s;
      margin-left: 8px;
    `,
    TracePageSearchBarBtnDisabled: css`
      label: TracePageSearchBarBtnDisabled;
      opacity: 0.5;
    `,
    TracePageSearchBarLocateBtn: css`
      label: TracePageSearchBarLocateBtn;
      padding: 1px 8px 4px;
    `,
  };
};

type TracePageSearchBarProps = {
  prevResult: () => void;
  nextResult: () => void;
  navigable: boolean;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  searchBarSuffix: string;
};

export default memo(function TracePageSearchBar(props: TracePageSearchBarProps) {
  const { navigable, nextResult, prevResult, onSearchValueChange, searchValue, searchBarSuffix } = props;
  const styles = useStyles2(getStyles);

  const suffix = searchValue ? (
    <span className={styles.TracePageSearchBarSuffix} data-testid="trace-page-search-bar-suffix">
      {searchBarSuffix}
    </span>
  ) : null;

  const btnClass = cx(styles.TracePageSearchBarBtn, { [styles.TracePageSearchBarBtnDisabled]: !searchValue });
  const uiFindInputInputProps = {
    'data-test': markers.IN_TRACE_SEARCH,
    className: cx(styles.TracePageSearchBarBar, ubFlexAuto),
    name: 'search',
    suffix,
  };

  return (
    <div className={styles.TracePageSearchBar}>
      <span className={ubJustifyEnd} style={{ display: 'flex' }}>
        <UiFindInput
          onChange={onSearchValueChange}
          value={searchValue}
          inputProps={uiFindInputInputProps}
          allowClear={true}
        />
        <>
          {navigable && (
            <>
              <Button
                className={btnClass}
                variant="secondary"
                disabled={!searchValue}
                type="button"
                icon="arrow-down"
                data-testid="trace-page-search-bar-next-result-button"
                onClick={nextResult}
              />
              <Button
                className={btnClass}
                variant="secondary"
                disabled={!searchValue}
                type="button"
                icon="arrow-up"
                data-testid="trace-page-search-bar-prev-result-button"
                onClick={prevResult}
              />
            </>
          )}
        </>
      </span>
    </div>
  );
});
