import React from 'react';

import { useTheme2 } from '@grafana/ui';

import { getStyles } from './styles';
import { MetricData, MetricsData } from './types';

export type LetterSearchProps = {
  filteredMetrics: MetricsData;
  disableTextWrap: boolean;
  updateLetterSearch: (letter: string) => void;
  letterSearch: string | null;
};

export function LetterSearch(props: LetterSearchProps) {
  const { filteredMetrics, disableTextWrap, updateLetterSearch, letterSearch } = props;

  const alphabetDictionary = alphabetCheck();

  const theme = useTheme2();
  const styles = getStyles(theme, disableTextWrap);

  filteredMetrics.forEach((m: MetricData, idx: number) => {
    const metricFirstLetter = m.value[0].toUpperCase();

    if (alphabet.includes(metricFirstLetter) && !alphabetDictionary[metricFirstLetter]) {
      alphabetDictionary[metricFirstLetter] += 1;
    }
  });

  // return the alphabet components with the correct style and behavior
  return (
    <div>
      {Object.keys(alphabetDictionary).map((letter: string) => {
        const active: boolean = alphabetDictionary[letter] > 0;
        // starts with letter search
        // filter by starts with letter
        // if same letter searched null out remove letter search
        function setLetterSearch() {
          updateLetterSearch(letter);
        }
        // selected letter to filter by
        const selectedClass: string = letterSearch === letter ? styles.selAlpha : '';
        // these letters are represented in the list of metrics
        const activeClass: string = active ? styles.active : styles.gray;

        return (
          <span
            onClick={active ? setLetterSearch : () => {}}
            className={`${selectedClass} ${activeClass}`}
            key={letter}
            data-testid={'letter-' + letter}
          >
            {letter + ' '}
            {/* {idx !== coll.length - 1 ? '|': ''} */}
          </span>
        );
      })}
    </div>
  );
}

function alphabetCheck() {
  const alphabetDict: { [char: string]: number } = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    G: 0,
    H: 0,
    I: 0,
    J: 0,
    K: 0,
    L: 0,
    M: 0,
    N: 0,
    O: 0,
    P: 0,
    Q: 0,
    R: 0,
    S: 0,
    T: 0,
    U: 0,
    V: 0,
    W: 0,
    X: 0,
    Y: 0,
    Z: 0,
  };

  return alphabetDict;
}

export const alphabet = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];
