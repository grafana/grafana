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

import React from 'react';
import cx from 'classnames';

import { createStyle } from '../../Theme';
import { css } from 'emotion';

export const getStyles = createStyle(() => {
  const ScrubberHandleExpansion = css`
    label: ScrubberHandleExpansion;
    cursor: col-resize;
    fill-opacity: 0;
    fill: #44f;
  `;
  const ScrubberHandle = css`
    label: ScrubberHandle;
    cursor: col-resize;
    fill: #555;
  `;
  const ScrubberLine = css`
    label: ScrubberLine;
    pointer-events: none;
    stroke: #555;
  `;
  return {
    ScrubberDragging: css`
      label: ScrubberDragging;
      & .${ScrubberHandleExpansion} {
        fill-opacity: 1;
      }
      & .${ScrubberHandle} {
        fill: #44f;
      }
      & > .${ScrubberLine} {
        stroke: #44f;
      }
    `,
    ScrubberHandles: css`
      label: ScrubberHandles;
      &:hover > .${ScrubberHandleExpansion} {
        fill-opacity: 1;
      }
      &:hover > .${ScrubberHandle} {
        fill: #44f;
      }
      &:hover + .${ScrubberLine} {
        stroke: #44f;
      }
    `,
    ScrubberHandleExpansion,
    ScrubberHandle,
    ScrubberLine,
  };
});

type ScrubberProps = {
  isDragging: boolean;
  position: number;
  onMouseDown: (evt: React.MouseEvent<any>) => void;
  onMouseEnter: (evt: React.MouseEvent<any>) => void;
  onMouseLeave: (evt: React.MouseEvent<any>) => void;
};

export default function Scrubber({ isDragging, onMouseDown, onMouseEnter, onMouseLeave, position }: ScrubberProps) {
  const xPercent = `${position * 100}%`;
  const styles = getStyles();
  const className = cx({ [styles.ScrubberDragging]: isDragging });
  return (
    <g className={className}>
      <g
        className={styles.ScrubberHandles}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* handleExpansion is only visible when `isDragging` is true */}
        <rect
          x={xPercent}
          className={styles.ScrubberHandleExpansion}
          style={{ transform: `translate(-4.5px)` }}
          width="9"
          height="20"
        />
        <rect
          x={xPercent}
          className={styles.ScrubberHandle}
          style={{ transform: `translate(-1.5px)` }}
          width="3"
          height="20"
        />
      </g>
      <line className={styles.ScrubberLine} y2="100%" x1={xPercent} x2={xPercent} />
    </g>
  );
}
