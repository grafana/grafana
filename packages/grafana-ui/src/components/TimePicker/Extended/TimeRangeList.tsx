import React, { memo } from 'react';
import { css } from 'emotion';
import { TimeOption } from '@grafana/data';
import { TimeRange } from '@grafana/data';
import TimeRangeTitle from './TimePickerTitle';
import TimeRangeOption from './TimeRangeOption';
import { mapToTimeRange } from './mapper';
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
  selected?: TimeRange;
  onSelect: (option: TimeRange) => void;
}

const TimeRangeList: React.FC<Props> = props => {
  const styles = getStyles();
  const { title } = props;

  if (!title) {
    return <div>{renderOptions(props)}</div>;
  }

  return (
    <>
      <div className={styles.title}>
        <TimeRangeTitle>{title}</TimeRangeTitle>
      </div>
      <div>{renderOptions(props)}</div>
    </>
  );
};

function renderOptions({ options, selected, onSelect }: Props): JSX.Element[] {
  return options.map((option, index) => (
    <TimeRangeOption
      key={keyForOption(option, index)}
      value={option}
      selected={isEqual(option, selected)}
      onSelect={option => onSelect(mapToTimeRange(option))}
    />
  ));
}

function keyForOption(option: TimeOption, index: number): string {
  return `${option.from}-${option.to}-${index}`;
}

function isEqual(x: TimeOption, y?: TimeRange): boolean {
  if (!y || !x) {
    return false;
  }
  return y.raw.from === x.from && y.raw.to === x.to;
}

export default memo(TimeRangeList);
