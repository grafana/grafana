import React, { memo, ReactNode } from 'react';
import { css } from 'emotion';
import { TimeOption } from '@grafana/data';
import { TimeRange } from '@grafana/data';
import TimeRangeTitle from './TimePickerTitle';
import TimeRangeOption from './TimeRangeOption';
import { mapOptionToTimeRange } from './mapper';
import { stylesFactory } from '../../../themes';

const getStyles = stylesFactory(() => {
  return {
    title: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 16px 5px 9px;
    `,
  };
});

interface Props {
  title?: string;
  options: TimeOption[];
  value?: TimeRange;
  onSelect: (option: TimeRange) => void;
  placeholderEmpty?: ReactNode;
}

const TimeRangeList = memo<Props>(props => {
  const styles = getStyles();
  const { title, options, placeholderEmpty } = props;

  if (typeof placeholderEmpty !== 'undefined' && options.length <= 0) {
    return <>{placeholderEmpty}</>;
  }

  if (!title) {
    return <Options {...props} />;
  }

  return (
    <>
      <div className={styles.title}>
        <TimeRangeTitle>{title}</TimeRangeTitle>
      </div>
      <Options {...props} />
    </>
  );
});

const Options = memo<Props>(({ options, value, onSelect }) => {
  return (
    <div>
      {options.map((option, index) => (
        <TimeRangeOption
          key={keyForOption(option, index)}
          value={option}
          selected={isEqual(option, value)}
          onSelect={option => onSelect(mapOptionToTimeRange(option))}
        />
      ))}
    </div>
  );
});

function keyForOption(option: TimeOption, index: number): string {
  return `${option.from}-${option.to}-${index}`;
}

function isEqual(x: TimeOption, y?: TimeRange): boolean {
  if (!y || !x) {
    return false;
  }
  return y.raw.from === x.from && y.raw.to === x.to;
}

export default TimeRangeList;
