import React from 'react';
import { css } from '@emotion/css';

export interface SummaryCellProps {
  func: string;
  value: string;
  showLabel: boolean;
}

export const SummaryCell = (props: SummaryCellProps) => {
  const cell = css`
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  `;

  if (props.showLabel) {
    return (
      <div className={cell}>
        <span>{props.func}:</span>
        <span>{props.value}</span>
      </div>
    );
  }
  return (
    <div>
      <span>{props.value}</span>
    </div>
  );
};
