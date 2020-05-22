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
import { css } from 'emotion';

import * as markers from './TracePageSearchBar.markers';
import UiFindInput from '../common/UiFindInput';
import { TNil } from '../types';

import { UIButton, UIInputGroup } from '../uiElementsContext';
import { createStyle } from '../Theme';
import { ubFlexAuto, ubJustifyEnd } from '../uberUtilityStyles';
import { memo } from 'react';

export const getStyles = createStyle(() => {
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
});

type TracePageSearchBarProps = {
  textFilter: string | TNil;
  prevResult: () => void;
  nextResult: () => void;
  clearSearch: () => void;
  focusUiFindMatches: () => void;
  resultCount: number;
  navigable: boolean;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  hideSearchButtons?: boolean;
};

export default memo(function TracePageSearchBar(props: TracePageSearchBarProps) {
  const {
    clearSearch,
    focusUiFindMatches,
    navigable,
    nextResult,
    prevResult,
    resultCount,
    textFilter,
    onSearchValueChange,
    searchValue,
    hideSearchButtons,
  } = props;
  const styles = getStyles();

  const count = textFilter ? <span className={styles.TracePageSearchBarCount}>{resultCount}</span> : null;

  const btnClass = cx(styles.TracePageSearchBarBtn, { [styles.TracePageSearchBarBtnDisabled]: !textFilter });
  const uiFindInputInputProps = {
    'data-test': markers.IN_TRACE_SEARCH,
    className: cx(styles.TracePageSearchBarBar, ubFlexAuto),
    name: 'search',
    suffix: count,
  };

  return (
    <div className={styles.TracePageSearchBar}>
      {/* style inline because compact overwrites the display */}
      <UIInputGroup className={ubJustifyEnd} compact style={{ display: 'flex' }}>
        <UiFindInput onChange={onSearchValueChange} value={searchValue} inputProps={uiFindInputInputProps} />
        {!hideSearchButtons && (
          <>
            {navigable && (
              <>
                <UIButton
                  className={cx(btnClass, styles.TracePageSearchBarLocateBtn)}
                  disabled={!textFilter}
                  htmlType="button"
                  onClick={focusUiFindMatches}
                >
                  <IoAndroidLocate />
                </UIButton>
                <UIButton
                  className={btnClass}
                  disabled={!textFilter}
                  htmlType="button"
                  icon="up"
                  onClick={prevResult}
                />
                <UIButton
                  className={btnClass}
                  disabled={!textFilter}
                  htmlType="button"
                  icon="down"
                  onClick={nextResult}
                />
              </>
            )}
            <UIButton
              className={btnClass}
              disabled={!textFilter}
              htmlType="button"
              icon="close"
              onClick={clearSearch}
            />
          </>
        )}
      </UIInputGroup>
    </div>
  );
});
