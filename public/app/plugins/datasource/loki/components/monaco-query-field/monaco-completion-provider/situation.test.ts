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
  it('identifies EMPTY autocomplete situations', () => {
    assertSituation('^', {
      type: 'EMPTY',
    });
  });

  it('identifies AT_ROOT autocomplete situations', () => {
    assertSituation('s^', {
      type: 'AT_ROOT',
    });
  });

  it('identifies AFTER_SELECTOR autocomplete situations', () => {
    assertSituation('{level="info"} ^', {
      type: 'AFTER_SELECTOR',
      afterPipe: false,
      hasSpace: true,
      logQuery: '{level="info"}',
    });

    // should not trigger AFTER_SELECTOR before the selector
    assertSituation('^ {level="info"}', null);

    // check for an error we had during the implementation
    assertSituation('{level="info" ^', null);

    assertSituation('{level="info"} | json ^', {
      type: 'AFTER_SELECTOR',
      afterPipe: false,
      hasSpace: true,
      logQuery: '{level="info"} | json',
    });

    assertSituation('{level="info"} | json |^', {
      type: 'AFTER_SELECTOR',
      afterPipe: true,
      hasSpace: false,
      logQuery: '{level="info"} | json |',
    });

    assertSituation('count_over_time({level="info"}^[10s])', {
      type: 'AFTER_SELECTOR',
      afterPipe: false,
      hasSpace: false,
      logQuery: '{level="info"}',
    });

    // should not trigger AFTER_SELECTOR before the selector
    assertSituation('count_over_time(^{level="info"}[10s])', null);

    // should work even when the query is half-complete
    assertSituation('count_over_time({level="info"}^)', {
      type: 'AFTER_SELECTOR',
      afterPipe: false,
      hasSpace: false,
      logQuery: '{level="info"}',
    });

    assertSituation('sum(count_over_time({place="luna"} | logfmt |^)) by (place)', {
      type: 'AFTER_SELECTOR',
      afterPipe: true,
      hasSpace: false,
      logQuery: '{place="luna"} | logfmt |',
    });
  });

  it('identifies AFTER_LOGFMT autocomplete situations', () => {
    assertSituation('{level="info"} | logfmt ^', {
      type: 'IN_LOGFMT',
      otherLabels: [],
      flag: false,
    });
    assertSituation('{level="info"} | logfmt --strict ^', {
      type: 'IN_LOGFMT',
      otherLabels: [],
      flag: true,
    });
    assertSituation('{level="info"} | logfmt --strict label, label1="expression"^', {
      type: 'IN_LOGFMT',
      otherLabels: ['label', 'label1'],
      flag: true,
    });
    assertSituation('count_over_time({level="info"} | logfmt ^', {
      type: 'IN_LOGFMT',
      otherLabels: [],
      flag: false,
    });
    assertSituation('count_over_time({level="info"} | logfmt ^)', {
      type: 'IN_LOGFMT',
      otherLabels: [],
      flag: false,
    });
    assertSituation('count_over_time({level="info"} | logfmt --keep-empty^)', {
      type: 'IN_LOGFMT',
      otherLabels: [],
      flag: true,
    });
    assertSituation('count_over_time({level="info"} | logfmt --keep-empty label1, label2^)', {
      type: 'IN_LOGFMT',
      otherLabels: ['label1', 'label2'],
      flag: true,
    });
    assertSituation('sum by (test) (count_over_time({level="info"} | logfmt ^))', {
      type: 'IN_LOGFMT',
      otherLabels: [],
      flag: false,
    });
    assertSituation('sum by (test) (count_over_time({level="info"} | logfmt label ^))', {
      type: 'IN_LOGFMT',
      otherLabels: ['label'],
      flag: false,
    });
    assertSituation('sum by (test) (count_over_time({level="info"} | logfmt --strict ^))', {
      type: 'IN_LOGFMT',
      otherLabels: [],
      flag: true,
    });
  });

  it('identifies IN_AGGREGATION autocomplete situations', () => {
    assertSituation('sum(^)', {
      type: 'IN_AGGREGATION',
    });
  });

  it('identifies IN_LABEL_SELECTOR_NO_LABEL_NAME autocomplete situations', () => {
    assertSituation('{^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [],
    });

    assertSituation('sum({^})', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [],
    });

    ['sum({label="value",^})', '{label="value",^}', '{label="value", ^}'].forEach((query) => {
      assertSituation(query, {
        type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
        otherLabels: [{ name: 'label', value: 'value', op: '=' }],
      });
    });
  });

  it('identifies labels from queries', () => {
    assertSituation('sum(count_over_time({level="info"})) by (^)', {
      type: 'IN_GROUPING',
      logQuery: '{level="info"}',
    });

    assertSituation('sum by (^) (count_over_time({level="info"}))', {
      type: 'IN_GROUPING',
      logQuery: '{level="info"}',
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

    // double-quoted label-values with escape and multiple quotes
    assertSituation('{one="val\\"1\\"",^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [{ name: 'one', value: 'val"1"', op: '=' }],
    });
  });

  it('identifies AFTER_UNWRAP autocomplete situations', () => {
    assertSituation('sum(sum_over_time({one="val1"} | unwrap^', {
      type: 'AFTER_UNWRAP',
      logQuery: '{one="val1"}',
    });

    assertSituation(
      'quantile_over_time(0.99, {cluster="ops-tools1",container="ingress-nginx"} | json | __error__ = "" | unwrap ^',
      {
        type: 'AFTER_UNWRAP',
        logQuery: '{cluster="ops-tools1",container="ingress-nginx"} | json | __error__ = ""',
      }
    );

    assertSituation('sum(sum_over_time({place="luna"} | unwrap ^ [5m])) by (level)', {
      type: 'AFTER_UNWRAP',
      logQuery: '{place="luna"}',
    });
  });

  it.each(['count_over_time({job="mysql"}[^])', 'rate({instance="server\\1"}[^])', 'rate({}[^'])(
    'identifies IN_RANGE autocomplete situations in metric query %s',
    (query: string) => {
      assertSituation(query, {
        type: 'IN_RANGE',
      });
    }
  );

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

  it('identifies AFTER_KEEP_AND_DROP autocomplete situations', () => {
    assertSituation('{label="value"} | logfmt | drop^', {
      type: 'AFTER_KEEP_AND_DROP',
      logQuery: '{label="value"} | logfmt ',
    });

    assertSituation('{label="value"} | logfmt | keep^', {
      type: 'AFTER_KEEP_AND_DROP',
      logQuery: '{label="value"} | logfmt ',
    });

    assertSituation('{label="value"} | logfmt | drop id,^', {
      type: 'AFTER_KEEP_AND_DROP',
      logQuery: '{label="value"} | logfmt ',
    });

    assertSituation('{label="value"} | logfmt | keep id,^', {
      type: 'AFTER_KEEP_AND_DROP',
      logQuery: '{label="value"} | logfmt ',
    });

    assertSituation('{label="value"} | logfmt | drop id, name="test",^', {
      type: 'AFTER_KEEP_AND_DROP',
      logQuery: '{label="value"} | logfmt ',
    });

    assertSituation('{label="value"} | logfmt | keep id, name="test",^', {
      type: 'AFTER_KEEP_AND_DROP',
      logQuery: '{label="value"} | logfmt ',
    });
  });
});
