// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/monaco-query-field/monaco-completion-provider/situation.test.ts
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

    assertSituation('sum(one) / ^', {
      type: 'AT_ROOT',
    });

    assertSituation('sum(^)', {
      type: 'IN_FUNCTION',
    });

    assertSituation('sum(one) / sum(^)', {
      type: 'IN_FUNCTION',
    });

    assertSituation('something{}[^]', {
      type: 'IN_DURATION',
    });

    assertSituation('something{label~^}', null);
  });

  it('handles label names', () => {
    assertSituation('something{^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      metricName: 'something',
      otherLabels: [],
      betweenQuotes: false,
    });

    assertSituation('sum(something) by (^)', {
      type: 'IN_GROUPING',
      metricName: 'something',
      otherLabels: [],
    });

    assertSituation('sum by (^) (something)', {
      type: 'IN_GROUPING',
      metricName: 'something',
      otherLabels: [],
    });

    assertSituation('something{one="val1",two!="val2",three=~"val3",four!~"val4",^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      metricName: 'something',
      otherLabels: [
        { name: 'one', value: 'val1', op: '=' },
        { name: 'two', value: 'val2', op: '!=' },
        { name: 'three', value: 'val3', op: '=~' },
        { name: 'four', value: 'val4', op: '!~' },
      ],
      betweenQuotes: false,
    });

    assertSituation('{^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [],
      betweenQuotes: false,
    });

    assertSituation('{one="val1",^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [{ name: 'one', value: 'val1', op: '=' }],
      betweenQuotes: false,
    });

    // single-quoted label-values with escape
    assertSituation("{one='val\\'1',^}", {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [{ name: 'one', value: "val'1", op: '=' }],
      betweenQuotes: false,
    });

    // double-quoted label-values with escape
    assertSituation('{one="val\\"1",^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [{ name: 'one', value: 'val"1', op: '=' }],
      betweenQuotes: false,
    });

    // backticked label-values with escape (the escape should not be interpreted)
    assertSituation('{one=`val\\"1`,^}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [{ name: 'one', value: 'val\\"1', op: '=' }],
      betweenQuotes: false,
    });
  });

  describe('utf-8 metric name support', () => {
    it('with utf8 metric name no label and no comma', () => {
      assertSituation(`{"metric.name"^}`, null);
    });

    it('with utf8 metric name no label', () => {
      assertSituation(`{"metric.name", ^}`, {
        type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
        metricName: 'metric.name',
        otherLabels: [],
        betweenQuotes: false,
      });
    });

    it('with utf8 metric name requesting utf8 labels in quotes', () => {
      assertSituation(`{"metric.name", "^"}`, {
        type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
        metricName: 'metric.name',
        otherLabels: [],
        betweenQuotes: true,
      });
    });

    it('with utf8 metric name with a legacy label', () => {
      assertSituation(`{"metric.name", label1="val", ^}`, {
        type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
        metricName: 'metric.name',
        otherLabels: [{ name: 'label1', value: 'val', op: '=' }],
        betweenQuotes: false,
      });
    });

    it('with utf8 metric name with a legacy label and no value', () => {
      assertSituation(`{"metric.name", label1="^"}`, {
        type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
        metricName: 'metric.name',
        labelName: 'label1',
        betweenQuotes: true,
        otherLabels: [],
      });
    });

    it('with utf8 metric name with a utf8 label and no value', () => {
      assertSituation(`{"metric.name", "utf8.label"="^"}`, {
        type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
        metricName: 'metric.name',
        labelName: '"utf8.label"',
        betweenQuotes: true,
        otherLabels: [],
      });
    });

    it('with utf8 metric name with a legacy label and utf8 label', () => {
      assertSituation(`{"metric.name", label1="val", "utf8.label"="^"}`, {
        type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
        metricName: 'metric.name',
        labelName: `"utf8.label"`,
        betweenQuotes: true,
        otherLabels: [{ name: 'label1', value: 'val', op: '=' }],
      });
    });

    it('with utf8 metric name with a utf8 label and legacy label', () => {
      assertSituation(`{"metric.name", "utf8.label"="val",  label1="^"}`, {
        type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
        metricName: 'metric.name',
        labelName: `label1`,
        betweenQuotes: true,
        otherLabels: [{ name: '"utf8.label"', value: 'val', op: '=' }],
      });
    });

    it('with utf8 metric name with grouping', () => {
      assertSituation(`sum by (^)(rate({"metric.name", label1="val"}[1m]))`, {
        type: 'IN_GROUPING',
        metricName: 'metric.name',
        otherLabels: [],
      });
    });
  });

  it('utf-8 label support', () => {
    assertSituation(`metric{"label": "^"}`, null);

    assertSituation(`metric{"label with space": "^"}`, null);

    assertSituation(`metric{"label_🤖": "^"}`, null);

    assertSituation(`metric{"Spaß": "^"}`, null);

    assertSituation(`{"metric", "Spaß": "^"}`, null);

    assertSituation('something{"job"=^}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      metricName: 'something',
      labelName: '"job"',
      betweenQuotes: false,
      otherLabels: [],
    });

    assertSituation('something{"job📈"=^}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      metricName: 'something',
      labelName: '"job📈"',
      betweenQuotes: false,
      otherLabels: [],
    });

    assertSituation('something{"job with space"=^,host="h1"}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      metricName: 'something',
      labelName: '"job with space"',
      betweenQuotes: false,
      otherLabels: [{ name: 'host', value: 'h1', op: '=' }],
    });
  });

  it('handles label values', () => {
    assertSituation('something{job=^}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      metricName: 'something',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [],
    });

    assertSituation('something{job!=^}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      metricName: 'something',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [],
    });

    assertSituation('something{job=~^}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      metricName: 'something',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [],
    });

    assertSituation('something{job!~^}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      metricName: 'something',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [],
    });

    assertSituation('something{job=^,host="h1"}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      metricName: 'something',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [{ name: 'host', value: 'h1', op: '=' }],
    });

    assertSituation('something{job="j1",host="^"}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      metricName: 'something',
      labelName: 'host',
      betweenQuotes: true,
      otherLabels: [{ name: 'job', value: 'j1', op: '=' }],
    });

    assertSituation('something{job="j1"^}', null);
    assertSituation('something{job="j1" ^ }', null);
    assertSituation('something{job="j1" ^   ,   }', null);

    assertSituation('{job=^,host="h1"}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      labelName: 'job',
      betweenQuotes: false,
      otherLabels: [{ name: 'host', value: 'h1', op: '=' }],
    });

    assertSituation('something{one="val1",two!="val2",three=^,four=~"val4",five!~"val5"}', {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      metricName: 'something',
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

  it('identifies all labels from queries when cursor is in middle', () => {
    // Note the extra whitespace, if the cursor is after whitespace, the situation will fail to resolve
    assertSituation('{one="val1", ^,two!="val2",three=~"val3",four!~"val4"}', {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
      otherLabels: [
        { name: 'one', value: 'val1', op: '=' },
        { name: 'two', value: 'val2', op: '!=' },
        { name: 'three', value: 'val3', op: '=~' },
        { name: 'four', value: 'val4', op: '!~' },
      ],
      betweenQuotes: false,
    });
  });
});
