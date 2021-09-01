import { getIntent, Intent } from './intent';

// we use the `^` character as the cursor-marker in the string.
function assertIntent(situation: string, expectedIntent: Intent | null) {
  // first we find the cursor-position
  const pos = situation.indexOf('^');
  if (pos === -1) {
    throw new Error('cursor missing');
  }

  // we remove the cursor-marker from the string
  const text = situation.replace('^', '');

  // sanity check, make sure no more cursor-markers remain
  if (text.indexOf('^') !== -1) {
    throw new Error('multiple cursors');
  }

  const result = getIntent(text, pos);

  if (expectedIntent === null) {
    expect(result).toStrictEqual(null);
  } else {
    expect(result).toMatchObject(expectedIntent);
  }
}

describe('intent', () => {
  it('handles things', () => {
    assertIntent('^', {
      type: 'HISTORY_AND_FUNCTIONS_AND_ALL_METRIC_NAMES',
    });

    assertIntent('sum(one) / ^', {
      type: 'FUNCTIONS_AND_ALL_METRIC_NAMES',
    });

    assertIntent('sum(^)', {
      type: 'ALL_METRIC_NAMES',
    });

    assertIntent('sum(one) / sum(^)', {
      type: 'ALL_METRIC_NAMES',
    });

    assertIntent('something{}[^]', {
      type: 'ALL_DURATIONS',
    });
  });

  it('handles label names', () => {
    assertIntent('something{^}', {
      type: 'LABEL_NAMES_FOR_SELECTOR',
      metricName: 'something',
      otherLabels: [],
    });

    assertIntent('sum(something) by (^)', {
      type: 'LABEL_NAMES_FOR_BY',
      metricName: 'something',
      otherLabels: [],
    });

    assertIntent('sum by (^) (something)', {
      type: 'LABEL_NAMES_FOR_BY',
      metricName: 'something',
      otherLabels: [],
    });

    assertIntent('something{one="val1",two="val2",^}', {
      type: 'LABEL_NAMES_FOR_SELECTOR',
      metricName: 'something',
      otherLabels: [
        { name: 'one', value: 'val1' },
        { name: 'two', value: 'val2' },
      ],
    });

    assertIntent('{^}', {
      type: 'LABEL_NAMES_FOR_SELECTOR',
      otherLabels: [],
    });

    assertIntent('{one="val1",^}', {
      type: 'LABEL_NAMES_FOR_SELECTOR',
      otherLabels: [{ name: 'one', value: 'val1' }],
    });
  });

  it('handles label values', () => {
    assertIntent('something{job=^}', {
      type: 'LABEL_VALUES',
      metricName: 'something',
      labelName: 'job',
      otherLabels: [],
    });

    assertIntent('something{job=^,host="h1"}', {
      type: 'LABEL_VALUES',
      metricName: 'something',
      labelName: 'job',
      otherLabels: [{ name: 'host', value: 'h1' }],
    });

    assertIntent('{job=^,host="h1"}', {
      type: 'LABEL_VALUES',
      labelName: 'job',
      otherLabels: [{ name: 'host', value: 'h1' }],
    });

    assertIntent('something{one="val1",two="val2",three=^,four="val4",five="val5"}', {
      type: 'LABEL_VALUES',
      metricName: 'something',
      labelName: 'three',
      otherLabels: [
        { name: 'one', value: 'val1' },
        { name: 'two', value: 'val2' },
        { name: 'four', value: 'val4' },
        { name: 'five', value: 'val5' },
      ],
    });
  });
});
