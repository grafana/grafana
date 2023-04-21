import React from 'react';

import { useTheme2 } from '@grafana/ui';

import { alphabet, alphabetCheck } from './helpers';
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
      ;
    </div>
  );
}
