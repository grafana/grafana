import {
  currentIdentifierAtCursor,
  findEnclosingSelector,
  hasAmbiguousStructure,
  insertLabelAbsence,
  insertLabelPresence,
  insertLabelValueAtCursor,
  insertLabelValueExclusion,
  insertMetric,
  isAmbiguous,
  parseFilters,
} from './promqlInsertion';

describe('insertMetric', () => {
  it('sets the metric on an empty query', () => {
    const r = insertMetric('node_cpu_seconds_total', { text: '', cursor: 0 });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('node_cpu_seconds_total');
      expect(r.cursor).toBe('node_cpu_seconds_total'.length);
    }
  });

  it('replaces a bare partial identifier', () => {
    const r = insertMetric('node_cpu_seconds_total', { text: 'node_cp', cursor: 7 });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('node_cpu_seconds_total');
    }
  });

  it('is ambiguous when the query has a selector', () => {
    const r = insertMetric('go_goroutines', { text: 'up{job="grafana"}', cursor: 3 });
    expect(isAmbiguous(r)).toBe(true);
  });

  it('is ambiguous when the query has a function', () => {
    const r = insertMetric('go_goroutines', { text: 'rate(node_cpu_seconds_total[5m])', cursor: 5 });
    expect(isAmbiguous(r)).toBe(true);
  });
});

describe('findEnclosingSelector', () => {
  it('returns null when the cursor is not inside a selector', () => {
    expect(findEnclosingSelector('up{job="grafana"}', 0)).toBeNull();
    expect(findEnclosingSelector('up{job="grafana"}', 2)).toBeNull();
    expect(findEnclosingSelector('up{job="grafana"}', 17)).toBeNull();
  });

  it('finds the enclosing selector', () => {
    const text = 'up{job="grafana"}';
    const r = findEnclosingSelector(text, 5); // between `{` and `}`
    expect(r).toEqual({ openBrace: 2, closeBrace: 16 });
  });

  it('ignores braces inside string literals when locating the enclosing selector', () => {
    // The `}` inside "bar}baz" should not terminate the selector.
    const text = 'foo{a="bar}baz"}';
    // cursor sits between `{` and `a` — clearly inside the selector.
    const r = findEnclosingSelector(text, 4);
    expect(r).toEqual({ openBrace: 3, closeBrace: 15 });
  });

  it('picks the innermost open brace when nested (defensive)', () => {
    const text = 'a{b{c="d"}}';
    const r = findEnclosingSelector(text, 6);
    expect(r?.openBrace).toBe(3);
  });
});

describe('hasAmbiguousStructure', () => {
  it('is false for a plain metric + single selector', () => {
    expect(hasAmbiguousStructure('http_requests_total{job="grafana"}')).toBe(false);
  });

  it('flags binary operators', () => {
    expect(hasAmbiguousStructure('a{x="1"} + b{x="1"}')).toBe(true);
  });

  it('flags function calls', () => {
    expect(hasAmbiguousStructure('rate(http_requests_total[5m])')).toBe(true);
  });

  it('flags multiple selectors', () => {
    expect(hasAmbiguousStructure('a{x="1"} and b{y="2"}')).toBe(true);
  });
});

describe('insertLabelValueAtCursor', () => {
  it('inserts into an empty selector', () => {
    const r = insertLabelValueAtCursor('job', 'grafana', { text: 'up{}', cursor: 3 });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('up{job="grafana"}');
    }
  });

  it('inserts before existing filters with a trailing comma', () => {
    const text = 'up{instance="a"}';
    // cursor right after `{`
    const r = insertLabelValueAtCursor('job', 'grafana', { text, cursor: 3 });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('up{job="grafana", instance="a"}');
    }
  });

  it('inserts after existing filters with a leading comma', () => {
    const text = 'up{instance="a"}';
    // cursor right before `}`
    const r = insertLabelValueAtCursor('job', 'grafana', { text, cursor: 15 });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('up{instance="a", job="grafana"}');
    }
  });

  it('does not double up commas when cursor is right after a comma', () => {
    const text = 'up{instance="a", }';
    const r = insertLabelValueAtCursor('job', 'grafana', { text, cursor: 17 });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('up{instance="a", job="grafana"}');
    }
  });

  it('builds a new selector when text is empty', () => {
    const r = insertLabelValueAtCursor('job', 'grafana', { text: '', cursor: 0 });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('{job="grafana"}');
    }
  });

  it('appends a selector when text is a bare metric name (no selector yet)', () => {
    const r = insertLabelValueAtCursor('job', 'grafana', { text: 'up', cursor: 2 });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('up{job="grafana"}');
    }
  });

  it('inserts into an existing selector when cursor is at the end of the text', () => {
    // Simulates: user clicks metric (cursor at end), then a label value, then another.
    const text = 'node_cpu_seconds_total{mode="idle"}';
    const r = insertLabelValueAtCursor('instance', 'node-01:9100', { text, cursor: text.length });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('node_cpu_seconds_total{mode="idle", instance="node-01:9100"}');
    }
  });

  it('is ambiguous when the query has a function even if cursor is in braces', () => {
    const text = 'rate(http_requests_total{status="200"}[5m])';
    // cursor inside the {status="200"} selector
    const r = insertLabelValueAtCursor('job', 'grafana', { text, cursor: 30 });
    expect(isAmbiguous(r)).toBe(true);
  });

  it('is ambiguous when there are multiple selectors', () => {
    const text = 'a{x="1"} + b{y="2"}';
    const r = insertLabelValueAtCursor('job', 'grafana', { text, cursor: 4 });
    expect(isAmbiguous(r)).toBe(true);
  });
});

describe('insertLabelValueExclusion', () => {
  it('inserts a negation matcher into an existing selector', () => {
    const text = 'node_cpu_seconds_total{mode="idle"}';
    const r = insertLabelValueExclusion('instance', 'node-01', { text, cursor: text.length });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('node_cpu_seconds_total{mode="idle", instance!="node-01"}');
    }
  });

  it('appends a negation selector to a bare metric', () => {
    const r = insertLabelValueExclusion('mode', 'idle', { text: 'node_cpu_seconds_total', cursor: 22 });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('node_cpu_seconds_total{mode!="idle"}');
    }
  });
});

describe('insertLabelPresence / insertLabelAbsence', () => {
  it('presence: label!=""', () => {
    const r = insertLabelPresence('mode', { text: 'node_cpu_seconds_total', cursor: 22 });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('node_cpu_seconds_total{mode!=""}');
    }
  });

  it('absence: label=""', () => {
    const r = insertLabelAbsence('mode', { text: 'node_cpu_seconds_total', cursor: 22 });
    expect(isAmbiguous(r)).toBe(false);
    if (!isAmbiguous(r)) {
      expect(r.text).toBe('node_cpu_seconds_total{mode=""}');
    }
  });
});

describe('parseFilters', () => {
  it('extracts the metric name', () => {
    expect(parseFilters('up{job="grafana"}').metric).toBe('up');
    expect(parseFilters('node_cpu_seconds_total').metric).toBe('node_cpu_seconds_total');
  });

  it('extracts equality filters', () => {
    const r = parseFilters('http_requests_total{job="grafana", method="GET"}');
    expect(r.metric).toBe('http_requests_total');
    expect(r.filters).toEqual([
      { label: 'job', value: 'grafana' },
      { label: 'method', value: 'GET' },
    ]);
  });

  it('handles empty selectors', () => {
    const r = parseFilters('up{}');
    expect(r.metric).toBe('up');
    expect(r.filters).toEqual([]);
  });
});

describe('currentIdentifierAtCursor', () => {
  it('extracts an identifier at the cursor', () => {
    expect(currentIdentifierAtCursor('node_cp', 7)).toBe('node_cp');
    expect(currentIdentifierAtCursor('rate(node_cpu)', 10)).toBe('node_cpu');
  });

  it('returns empty when cursor is on non-identifier', () => {
    expect(currentIdentifierAtCursor('up{}', 3)).toBe('');
  });
});
