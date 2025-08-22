// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/promql.test.ts
import Prism from 'prismjs';

import { promqlGrammar } from './promql';

describe('Loki syntax', () => {
  it('should highlight Loki query correctly', () => {
    expect(Prism.highlight('{key="val#ue"}', promqlGrammar, 'promql')).toBe(
      '<span class="token context-labels"><span class="token punctuation">{</span><span class="token label-key attr-name">key</span>=<span class="token label-value attr-value">"val#ue"</span></span><span class="token punctuation">}</span>'
    );
    expect(Prism.highlight('{key="#value"}', promqlGrammar, 'promql')).toBe(
      '<span class="token context-labels"><span class="token punctuation">{</span><span class="token label-key attr-name">key</span>=<span class="token label-value attr-value">"#value"</span></span><span class="token punctuation">}</span>'
    );
    expect(Prism.highlight('{key="value#"}', promqlGrammar, 'promql')).toBe(
      '<span class="token context-labels"><span class="token punctuation">{</span><span class="token label-key attr-name">key</span>=<span class="token label-value attr-value">"value#"</span></span><span class="token punctuation">}</span>'
    );
    expect(Prism.highlight('#test{key="value"}', promqlGrammar, 'promql')).toBe(
      '<span class="token comment">#test{key="value"}</span>'
    );
    expect(Prism.highlight('{key="value"}#test', promqlGrammar, 'promql')).toBe(
      '<span class="token context-labels"><span class="token punctuation">{</span><span class="token label-key attr-name">key</span>=<span class="token label-value attr-value">"value"</span></span><span class="token punctuation">}</span><span class="token comment">#test</span>'
    );
  });
});
