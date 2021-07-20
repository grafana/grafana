import React, { ReactNode } from 'react';
import { css } from '@emotion/css';
import { TimeOption } from '@grafana/data';
import { TimePickerTitle } from './TimePickerTitle';
import { TimeRangeOption } from './TimeRangeOption';
import { stylesFactory } from '../../../themes';

const getStyles = stylesFactory(() => {
  return {
    title: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px 5px 9px;
    `,
  };
});

const getOptionsStyles = stylesFactory(() => {
  return {
    grow: css`
      flex-grow: 1;
      align-items: flex-start;
    `,
  };
});

interface Props {
  title: string;
  options: TimeOption[];
  value?: TimeOption;
  onChange: (option: TimeOption) => void;
  placeholderEmpty?: ReactNode;
}

export const TimeRangeList: React.FC<Props> = (props) => {
  const styles = getStyles();
  const { title, options, placeholderEmpty } = props;

  if (typeof placeholderEmpty !== 'undefined' && options.length <= 0) {
    return <>{placeholderEmpty}</>;
  }

  if (!title) {
    return <Options {...props} />;
  }

  return (
    <section aria-label={title}>
      <form>
        <fieldset>
          <div className={styles.title}>
            <TimePickerTitle>{title}</TimePickerTitle>
          </div>
          <Options {...props} />
        </fieldset>
      </form>
    </section>
  );
};

const Options: React.FC<Props> = ({ options, value, onChange, title }) => {
  const styles = getOptionsStyles();

  return (
    <>
      <ul aria-roledescription="Time range selection">
        {options.map((option, index) => (
          <TimeRangeOption
            key={keyForOption(option, index)}
            value={option}
            selected={isEqual(option, value)}
            onSelect={onChange}
            name={title}
          />
        ))}
      </ul>
      <div className={styles.grow} />
    </>
  );
};

function keyForOption(option: TimeOption, index: number): string {
  return `${option.from}-${option.to}-${index}`;
}

function isEqual(x: TimeOption, y?: TimeOption): boolean {
  if (!y || !x) {
    return false;
  }
  return y.from === x.from && y.to === x.to;
}
