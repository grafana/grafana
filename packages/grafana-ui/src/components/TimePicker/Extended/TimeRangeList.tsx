import React from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme, TimeOption } from '@grafana/data';
import { css } from 'emotion';
import TimeRangeTitle from './TimeRangeTitle';
import TimeRangeOption from './TimeRangeOption';

interface Props {
  title?: string;
  options: TimeOption[];
  selected?: TimeOption;
  onSelect: (option: TimeOption) => void;
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
  return options.map(option => (
    <TimeRangeOption value={option} selected={isEqual(option, selected)} onSelect={onSelect} />
  ));
}

function isEqual(x: TimeOption, y?: TimeOption): boolean {
  if (!y || !x) {
    return false;
  }
  return y.from === x.from && y.to === x.to;
}

export default TimeRangeList;
