import { formatLokiQuery } from './formatterTS';

describe('formats a logql query', () => {
  const query =
    '{delta!~"",bravo!="",alpha="",charlie=~""}|=""!=""|~""!~""|json|logfmt|regexp""|unpack|pattern""|json alpha="",bravo=""|label=""|label!=ip("")|label>1s|label<=100GB|label==1|line_format""|label_format newLevel=level,newMessage="{{.msg}}"';
  expect(formatLokiQuery(query)).toBe(
    `{alpha="", bravo!="", charlie=~"", delta!~""}\n  |= "" != "" |~ "" !~ ""\n  | json | logfmt | regexp"" | unpack | pattern""\n  | json alpha="", bravo=""\n  | label="" | label!=ip("") | label>1s | label<=100GB | label==1\n  | line_format ""\n  | label_format newLevel=level, newMessage="{{.msg}}"`
  );
});

describe('formatSelector()', () => {
  it('correctly spaces selectors with multiple matchers', () => {
    const query = '{alpha = "",bravo != "",charlie =~ "",delta !~ ""}';
    expect(formatLokiQuery(query)).toBe('{alpha="", bravo!="", charlie=~"", delta!~""}');
  });

  it('orders all matchers in alphabetical order', () => {
    const query = '{delta!~"", bravo!="", alpha="", charlie=~""}';
    expect(formatLokiQuery(query)).toBe('{alpha="", bravo!="", charlie=~"", delta!~""}');
  });
});

describe('formatPipelineExpr()', () => {
  it('correctly formats a pipeline expression', () => {
    const query = '{}|="line contains"!="line does not contain"|logfmt|label="value"';
    expect(formatLokiQuery(query)).toBe(
      '{}\n  |= "line contains" != "line does not contain"\n  | logfmt\n  | label="value"'
    );
  });
});

describe('formatLineFilter()', () => {
  it('correctly formats a line filter', () => {
    const query = '{}|="line contains"';
    expect(formatLokiQuery(query)).toBe('{}\n  |= "line contains"');
  });

  it('correctly formats multiple line filters', () => {
    const query =
      '{}|="line contains"!="line does not contain"|~"line contains (regex)"!~"line does not contain (regex)"';
    expect(formatLokiQuery(query)).toBe(
      '{}\n  |= "line contains" != "line does not contain" |~ "line contains (regex)" !~ "line does not contain (regex)"'
    );
  });
});

describe('formatLabelParser()', () => {
  it('correctly formats a label parser', () => {
    const query = '{}|logfmt';
    expect(formatLokiQuery(query)).toBe('{}\n  | logfmt');
  });

  it('correctly formats a label parser with string', () => {
    const query = '{}|regexp ""';
    expect(formatLokiQuery(query)).toBe('{}\n  | regexp""');
  });

  it('correctly formats multiple label parsers', () => {
    const query = '{}|json|logfmt|regexp""|unpack|pattern""';
    expect(formatLokiQuery(query)).toBe('{}\n  | json | logfmt | regexp"" | unpack | pattern""');
  });

  it('correctly formats a label parser with other pipeline expressions', () => {
    const query = '{} |= "line contains"|logfmt';
    expect(formatLokiQuery(query)).toBe('{}\n  |= "line contains"\n  | logfmt');
  });
});

describe('formatJsonExpressionParser()', () => {
  it('correctly formats a json expression parser', () => {
    const query = '{}|json label = "value"';
    expect(formatLokiQuery(query)).toBe('{}\n  | json label="value"');
  });

  it('correctly formats a json expression parser with multiple expressions', () => {
    const query = '{}|json label = "value",label2 = "value2"';
    expect(formatLokiQuery(query)).toBe('{}\n  | json label="value", label2="value2"');
  });

  it('correctly formats a json expression parser with other pipeline expressions', () => {
    const query = '{} |= "line contains" | logfmt |json label = "value",label2 = "value2"';
    expect(formatLokiQuery(query)).toBe(
      '{}\n  |= "line contains"\n  | logfmt\n  | json label="value", label2="value2"'
    );
  });
});

describe('formatLabelFilter()', () => {
  it('correctly formats a label filter', () => {
    const query = '{}|label = "value"';
    expect(formatLokiQuery(query)).toBe('{}\n  | label="value"');
  });

  it('correctly formats multiple label filters', () => {
    const query = '{}|label = "value" | label2 != "value2" | label3 =~ "value3"';
    expect(formatLokiQuery(query)).toBe('{}\n  | label="value" | label2!="value2" | label3=~"value3"');
  });

  it('correctly formats a label filter with other pipeline expressions', () => {
    const query = '{} |= "line contains" | logfmt | label = "value"';
    expect(formatLokiQuery(query)).toBe('{}\n  |= "line contains"\n  | logfmt\n  | label="value"');
  });
});

describe('formatLineFormatExpr()', () => {
  it('correctly formats a line format expression', () => {
    const query = '{}|line_format"{{.label}}"';
    expect(formatLokiQuery(query)).toBe('{}\n  | line_format "{{.label}}"');
  });

  it('correctly formats a line format expression with other pipeline expressions', () => {
    const query = '{} |= "line contains" | logfmt |line_format"{{.label}}"';
    expect(formatLokiQuery(query)).toBe('{}\n  |= "line contains"\n  | logfmt\n  | line_format "{{.label}}"');
  });
});

describe('formatLabelFormatExpr()', () => {
  it('correctly formats a label format expression', () => {
    const query1 = '{}|label_format newLabel = "value"';
    expect(formatLokiQuery(query1)).toBe('{}\n  | label_format newLabel="value"');

    const query2 = '{}|label_format newLabel = label';
    expect(formatLokiQuery(query2)).toBe('{}\n  | label_format newLabel=label');
  });

  it('correctly formats a label format expression with multiple expressions', () => {
    const query = '{}|label_format newLabel = "value",newLabel2 = label2';
    expect(formatLokiQuery(query)).toBe('{}\n  | label_format newLabel="value", newLabel2=label2');
  });

  it('correctly formats a label format expression with other pipeline expressions', () => {
    const query = '{} |= "line contains" | logfmt | label_format newLabel = "value"';
    expect(formatLokiQuery(query)).toBe('{}\n  |= "line contains"\n  | logfmt\n  | label_format newLabel="value"');
  });
});

describe('formatLineComment()', () => {
  it('correctly formats a line comment in the middle of pipeline expressions', () => {
    const query = '{}\n  |= "line contains"\n#   comment\n  | logfmt';
    expect(formatLokiQuery(query)).toBe('{}\n  |= "line contains"\n  # comment\n  | logfmt');
  });
});
