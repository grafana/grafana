import { getSituation, Situation } from './situation';

// we use the `^` character as the cursor-marker in the string.
function assertSituation(situation: string, expectedSituation: Situation | null) {
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

  const result = getSituation(text, pos);

  if (expectedSituation === null) {
    expect(result).toStrictEqual(null);
  } else {
    expect(result).toMatchObject(expectedSituation);
  }
}

describe('situation', () => {
  it('handles things', () => {
    assertSituation('^', {
      type: 'EMPTY',
    });

    assertSituation('s^', {
      type: 'AT_ROOT',
    });

    assertSituation('{level="info"} ^', {
      type: 'AFTER_SELECTOR',
      afterPipe: false,
      labels: [{ name: 'level', value: 'info', op: '=' }],
    });

    // should not trigger AFTER_SELECTOR before the selector
    assertSituation('^ {level="info"}', null);

    // check for an error we had during the implementation
    assertSituation('{level="info" ^', null);

    assertSituation('{level="info"} | json ^', {
      type: 'AFTER_SELECTOR',
      afterPipe: false,
      labels: [{ name: 'level', value: 'info', op: '=' }],
    });

    assertSituation('{level="info"} | json | ^', {
      type: 'AFTER_SELECTOR',
      afterPipe: true,
      labels: [{ name: 'level', value: 'info', op: '=' }],
    });

    assertSituation('count_over_time({level="info"}^[10s])', {
      type: 'AFTER_SELECTOR',
      afterPipe: false,
      labels: [{ name: 'level', value: 'info', op: '=' }],
    });

    // should not trigger AFTER_SELECTOR before the selector
    assertSituation('count_over_time(^{level="info"}[10s])', null);

    // should work even when the query is half-complete
    assertSituation('count_over_time({level="info"}^)', {
      type: 'AFTER_SELECTOR',
      afterPipe: false,
      labels: [{ name: 'level', value: 'info', op: '=' }],
    });

    assertSituation('sum(^)', {
      type: 'IN_AGGREGATION',
    });
  });

  it('handles label names', () => {
    assertSituation('{^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [],
    });

    assertSituation('sum(count_over_time({level="info"})) by (^)', {
      type: 'IN_GROUPING',
      otherLabels: [{ name: 'level', value: 'info', op: '=' }],
    });

    assertSituation('sum by (^) (count_over_time({level="info"}))', {
      type: 'IN_GROUPING',
      otherLabels: [{ name: 'level', value: 'info', op: '=' }],
    });

    assertSituation('{one="val1",two!="val2",three=~"val3",four!~"val4",^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [
        { name: 'one', value: 'val1', op: '=' },
        { name: 'two', value: 'val2', op: '!=' },
        { name: 'three', value: 'val3', op: '=~' },
        { name: 'four', value: 'val4', op: '!~' },
      ],
    });

    assertSituation('{one="val1",^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [{ name: 'one', value: 'val1', op: '=' }],
    });

    // double-quoted label-values with escape
    assertSituation('{one="val\\"1",^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [{ name: 'one', value: 'val"1', op: '=' }],
    });

    // backticked label-values with escape (the escape should not be interpreted)
    assertSituation('{one=`val\\"1`,^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [{ name: 'one', value: 'val\\"1', op: '=' }],
    });
  });

  it('handles label values', () => {
    assertSituation('{job=^}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [],
    });

    assertSituation('{job!=^}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [],
    });

    assertSituation('{job=~^}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [],
    });

    assertSituation('{job!~^}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [],
    });

    assertSituation('{job=^,host="h1"}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [{ name: 'host', value: 'h1', op: '=' }],
    });

    assertSituation('{job="j1",host="^"}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      labelName: 'host',
      betweenQuotes: true,
      otherLabels: [{ name: 'job', value: 'j1', op: '=' }],
    });

    assertSituation('{job="j1"^}', null);
    assertSituation('{job="j1" ^ }', null);
    assertSituation('{job="j1" ^   ,   }', null);

    assertSituation('{job=^,host="h1"}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [{ name: 'host', value: 'h1', op: '=' }],
    });

    assertSituation('{one="val1",two!="val2",three=^,four=~"val4",five!~"val5"}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      labelName: 'three',
      betweenQuotes: false,
      otherLabels: [
        { name: 'one', value: 'val1', op: '=' },
        { name: 'two', value: 'val2', op: '!=' },
        { name: 'four', value: 'val4', op: '=~' },
        { name: 'five', value: 'val5', op: '!~' },
      ],
    });
  });
});
