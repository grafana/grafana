import React from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme, TimeOption } from '@grafana/data';
import { css } from 'emotion';
import TimeRangeTitle from './TimeRangeTitle';
import TimeRangeOption from './TimeRangeOption';
import { TimeRange } from '@grafana/data';
import { stringToDateTimeType } from '../time';

interface Props {
  title?: string;
  options: TimeOption[];
  selected?: TimeRange;
  onSelect: (option: TimeRange) => void;
}

const getLabelStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    title: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 16px 5px 9px;
    `,
  };
});

const TimeRangeList: React.FC<Props> = props => {
  const theme = useTheme();
  const styles = getLabelStyles(theme);
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
      onSelect={option => onSelect(toTimeRange(option))}
    />
  ));
}

function toTimeRange(option: TimeOption): TimeRange {
  return {
    from: stringToDateTimeType(option.from),
    to: stringToDateTimeType(option.to),
    raw: {
      from: option.from,
      to: option.to,
    },
  };
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

export default TimeRangeList;
