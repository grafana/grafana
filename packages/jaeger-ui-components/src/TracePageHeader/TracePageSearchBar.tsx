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

import * as React from 'react';
import cx from 'classnames';
import IoAndroidLocate from 'react-icons/lib/io/android-locate';
import { css } from '@emotion/css';
import { Button, useStyles2 } from '@grafana/ui';

import * as markers from './TracePageSearchBar.markers';
import UiFindInput from '../common/UiFindInput';

import { ubFlexAuto, ubJustifyEnd } from '../uberUtilityStyles';
// eslint-disable-next-line no-duplicate-imports
import { memo } from 'react';

export const getStyles = () => {
  return {
    TracePageSearchBar: css`
      label: TracePageSearchBar;
    `,
    TracePageSearchBarBar: css`
      label: TracePageSearchBarBar;
      max-width: 20rem;
      transition: max-width 0.5s;
      &:focus-within {
        max-width: 100%;
      }
    `,
    TracePageSearchBarCount: css`
      label: TracePageSearchBarCount;
      opacity: 0.6;
    `,
    TracePageSearchBarBtn: css`
      label: TracePageSearchBarBtn;
      border-left: none;
      transition: 0.2s;
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
  clearSearch: () => void;
  focusUiFindMatches: () => void;
  resultCount: number;
  navigable: boolean;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
};

export default memo(function TracePageSearchBar(props: TracePageSearchBarProps) {
  const {
    clearSearch,
    focusUiFindMatches,
    navigable,
    nextResult,
    prevResult,
    resultCount,
    onSearchValueChange,
    searchValue,
  } = props;
  const styles = useStyles2(getStyles);

  const count = searchValue ? <span className={styles.TracePageSearchBarCount}>{resultCount}</span> : null;

  const btnClass = cx(styles.TracePageSearchBarBtn, { [styles.TracePageSearchBarBtnDisabled]: !searchValue });
  const uiFindInputInputProps = {
    'data-test': markers.IN_TRACE_SEARCH,
    className: cx(styles.TracePageSearchBarBar, ubFlexAuto),
    name: 'search',
    suffix: count,
  };

  return (
    <div className={styles.TracePageSearchBar}>
      <span className={ubJustifyEnd} style={{ display: 'flex' }}>
        <UiFindInput onChange={onSearchValueChange} value={searchValue} inputProps={uiFindInputInputProps} />
        <>
          {navigable && (
            <>
              <Button
                className={cx(btnClass, styles.TracePageSearchBarLocateBtn)}
                disabled={!searchValue}
                type="button"
                onClick={focusUiFindMatches}
              >
                <IoAndroidLocate />
              </Button>
              <Button className={btnClass} disabled={!searchValue} type="button" icon="arrow-up" onClick={prevResult} />
              <Button
                className={btnClass}
                disabled={!searchValue}
                type="button"
                icon="arrow-down"
                onClick={nextResult}
              />
            </>
          )}
          <Button
            variant={'secondary'}
            fill={'text'}
            // className={btnClass}
            disabled={!searchValue}
            type="button"
            icon="times"
            onClick={clearSearch}
            title={'Clear search'}
          />
        </>
      </span>
    </div>
  );
});
